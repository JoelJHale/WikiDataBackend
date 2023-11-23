// Runs automatically daily and on date gathering edits/creation to update an item database.
module.exports = async function (context, myTimer) {
    
    const { CosmosClient } = require("@azure/cosmos");
    const endpoint = "";
    const key = "";
    const client = new CosmosClient({ endpoint, key });

    const databaseId = "WikiData";
    const containerId = "SiteGatheringData";
    const dataContainerId = "GatheredData";
    const database = client.database(databaseId);
    const container = database.container(containerId);
    const dataContainer = database.container(dataContainerId);
    
    class WikiGatherer
    {
        static ListSettings = 
        {
            Page_Links: {
                APIAction: "action=parse&format=json&prop=links", 
                APISource: "page",
                List_Access: ["parse","links"],
                Link_Location: "*"
            },
            Category: {
                APIAction: "action=query&format=json&list=categorymembers&cmprop=title&cmlimit=max", 
                APISource: "cmtitle", 
                List_Access: ["query","categorymembers"],
                Link_Location: "title"
            }
        }
        site
        item
        siteLink
        defaults = {}
        pageList = []
        data = {}
        version
        defaultHeader= {method: 'GET', headers: new Headers({"Api-User-Agent": "FandomDataGatherer/1.0 (joelh2003@gmail.com) JavaScript"})}

        constructor(site, options, item){
            
            this.site = site
            this.item = item
            this.siteLink = "https://"+site+".fandom.com"
            this.defaults = options
            
        }
        async LoadList(page)
        {
            var linkSettings = WikiGatherer.ListSettings[this.defaults.source_type]
            var link = this.siteLink+"/api.php?"+linkSettings.APIAction+"&"+linkSettings.APISource+"="+page
            var info = await fetch(link, this.defaultHeader)
            var jsonInfo = await info.json()
            
            var links = jsonInfo[linkSettings.List_Access[0]][linkSettings.List_Access[1]]
            for (var link in links) {
                if (links[link].ns == 0) this.pageList.push(links[link][linkSettings.Link_Location])
            }
            return
        }
        async LoadItemList()
        {
            var obj = await DataLoader.GetItemsData(this.site, this.item)
            this.data = obj?.data
            this.version = obj?.version
            context.log("Data: "+ this.data)
            if (typeof this.defaults.source_page == "string")
            {
                context.log("String detected " + this.defaults.source_page)
                await this.LoadList(this.defaults.source_page);
            }
            else if (Array.isArray(this.defaults.source_page))
            {
                context.log("Array detected " + this.defaults.source_page)
                for (var i in this.defaults.source_page)
                    await this.LoadList(this.defaults.source_page[i])
            }
            return this.pageList
        }
        GetPageData(page)
        {
            return this.data[page]
        }
        FindProperty(propData, label, typeData)
        {
            for (var id in propData)
            {
                if (Path(propData[id],typeData.dataPath)?.source == label) return propData[id]
            }
            return null
        }
        GetPropertyData(inputData, properties) {
            var outputData = {}
            var propertyData = JSON.parse(inputData.parse.properties[0]["*"])[0].data
            for (var id in properties) {
                var typeData =Types[properties[id].type]
                var elem = this.FindProperty(propertyData, properties[id].location, typeData)
                context.log(elem)
                if (elem == null) {
                    if (properties[id].required == true) throw new TypeError("Page didn't have required property: " + properties[id].location)
                    else outputData[properties[id].displayName] = properties[id].default
                }
                else{
                    var data = Path(Path(elem, typeData.dataPath), typeData.dataLoc).match(typeData.format)[1]
                    if (properties[id].type == "number") data = Number.parseFloat(data.replace(",",""))
                    outputData[properties[id].displayName] = data
                }
            }
            return outputData
        }
        
        GetPageData(inputData, page_templates){
            var foundData = {}
            var pageData = inputData.parse.wikitext["*"]
            for (var id in page_templates){
                // TODO change to .find and .substr (or their JS equivalent) to simplify REGEX
                var data = pageData.match("\\|"+page_templates[id].location+"\\s?=\\s?([^\x7C\\n}]+)(?:\x7C|\\n|}})")[1]
                if (page_templates[id].type == "number") data = Number.parseFloat(data.replace(",",""))
                foundData[page_templates[id].displayName] = data
            }
            return foundData
        }
        async UpdatePageData(page)
        {
            this.data[page] = await fetch(this.siteLink+"/api.php?action=parse&format=json&page=" + page + "&prop=templates%7Cwikitext%7Cimages%7Cproperties%7Cparsetree", this.defaultHeader).then(
                apiData => apiData.json().then
                (
                    jsonData => {
                        try {
                            var retData = { name: page,update: new Date()}
                            // May switch to using prop=parsetree
                            if (this.defaults.array_data.properties) Object.assign(retData, this.GetPropertyData(jsonData, this.defaults.array_data.properties))
                            if (this.defaults.array_data.page_templates) Object.assign(retData, this.GetPageData(jsonData, this.defaults.array_data.page_templates))
                            return retData
                        }
                        catch (err) {
                            console.error(page + ": Doesn't have setup for page reading")
                            console.error(err)
                            return null
                        }
                    }
                )
            )
            if (this.data[page] == null) delete this.data[page]
            return this.data[page]
        }
        async GetLastEdit(page)
        {
            return fetch(this.siteLink+"/api.php?action=query&format=json&titles="+page+"&prop=revisions&rvprop=timestamp", this.defaultHeader).then(
                data => data.json().then(jsonData => {
                    for (var id in jsonData.query.pages) return new Date(jsonData.query.pages[id].revisions[0].timestamp)
                })
            )
        }
        async RemoveUnchangedItems(dist=this.pageList.length)
        {
            var changedPages = []
            // Breaks Page List into sections of 50 to work with API
            for (let i = 0; i < dist; i+=50 ) 
            {
                var subArray = this.pageList.slice(i, Math.min(i+50, dist))
                var titlesFormat = subArray.join('%7C')
                await fetch(this.siteLink+"/api.php?action=query&format=json&titles="+titlesFormat+"&prop=revisions&rvprop=timestamp", this.defaultHeader)
                    .then(apiData => apiData.json().then(
                        (jsonData) => {
                            for (var id in jsonData.query.pages){
                                var pageInfo = jsonData.query.pages[id]
                                var pageName = pageInfo.title
                                var lastRevision = new Date(pageInfo.revisions[0].timestamp)
                                if (!(this.data[pageName]) || !(this.data[pageName].update) || (new Date(this.data[pageName].update) < lastRevision)) changedPages.push(pageName)
                            }
                        }
                    ))
            }
            this.pageList = changedPages
            return changedPages
        }
        async UpdatePageListData()
        {
            for(var id in this.pageList)
            {
                await this.UpdatePageData(this.pageList[id])
            }
            return this.data
        }
        async UpdateData()
        {
            await this.LoadItemList()
            context.log("Retrieved List: " + this.pageList.length)
            context.log(this.version)
            context.log(this.defaults.version)
            if (this.version == this.defaults.version)
            {
                context.log("Removing extra stuff")
                await this.RemoveUnchangedItems()
                context.log("Removed redundant data, to be processed: " + this.pageList.length)
            }
            await this.UpdatePageListData()
            context.log("Data successfully updated: " + this.data)
            this.version = this.defaults.version
            this.SaveData()
            return true
        }
        SaveData()
        {
            DataLoader.Save(this.site, this.item, this.data, this.version)
        }
    }

    class Types
    {
        static number = {format:"([0-9|\.|\,]+)", dataPath:"data", dataLoc:"value"} 
        static text = {format:"(.*)", dataPath:"data", dataLoc:"value"}
        static wrapped = {format:">(.*)<", dataPath:"data", dataLoc:"value"}
        static image = {format:"(.*)", dataPath:"data.[0]", dataLoc:"url"}
    }
    
    function Path(obj, path)
    {
        var recursive = obj
        var indexs = path.split(".")
        console.log(indexs)
        for (var i in indexs)
        {
            console.log(recursive)
            if (indexs[i].includes("[")) {
                indexs[i] = Number.parseInt(indexs[i].replace("[","").replace("]",""))
            }
            recursive = recursive[indexs[i]]
        }
        return recursive
    }

    class DataLoader
    {
        static async GetItemsData(site, item)
        {
            var id = site+"__"+item
            var sqlData = await dataContainer.item(id, id).read()
            var data = sqlData.resource
            if (data == undefined)
            {
                context.log("No Data retrieved, returning empty object." + {})
                return {}
            }
            context.log("Data found, returning:" + data.data)
            return {data:data.data, version:data.version}
        }
        static async Save(site, item, data, ver)
        {
            var id = site+"__"+item
            try{
                await dataContainer.item(id).replace({id: id, data: data, version:ver})
            }
            catch(err)
            {
                await dataContainer.items.create({id: id, data: data, version:ver})
            }
        }
    }

    
    var sqlData = await container.items.readAll().fetchAll()
    var siteDataList = sqlData.resources
    for (var id in siteDataList)
    {
        const siteData = siteDataList[id]
        const siteLink = siteData.link
        for (var option in siteData.options)
        {
            context.log(option)
            var wikiGatherer = new WikiGatherer(siteLink, siteData.options[option], option)
            await wikiGatherer.UpdateData()
        }
    }
    
    var timeStamp = new Date().toISOString();
    
    if (myTimer.isPastDue)
    {
        context.log('JavaScript is running late!');
    }
    context.log('JavaScript timer trigger function ran!', timeStamp);  
};

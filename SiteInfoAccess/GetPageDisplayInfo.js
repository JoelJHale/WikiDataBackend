// Retrieves Fandom information for Web Application in regards to certain items to give hints on what to fill in and give an idea on what the settings will create.
module.exports = async function (context, req) {
    context.log('JavaScript HTTP trigger function processed a request.');
    const site = req.query.site
    const source_page = req.query.page
    const source_type = req.query.type

    
    const siteLink = "https://"+site+".fandom.com"
    
    const defaultHeader= {method: 'GET', headers: new Headers({"Api-User-Agent": "FandomDataGatherer/1.0 (joelh2003@gmail.com) JavaScript"})}
    const ListSettings = 
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

    var linkSettings = ListSettings[source_type]
    var link = siteLink+"/api.php?"+linkSettings.APIAction+"&"+linkSettings.APISource+"="+source_page
    var info = await fetch(link, defaultHeader)
    var jsonInfo = await info.json()

    var pageList = []
    
    var links = jsonInfo[linkSettings.List_Access[0]][linkSettings.List_Access[1]]
    for (var link in links) {
        if (links[link].ns == 0) pageList.push(links[link][linkSettings.Link_Location])
    }
    
    if (pageList.length == 0)
    {
        context.res = {
            status: 400,
            body: site + " doesn't have page " + source_page
        }
    }
    else
    {
        var pageInfo = []
        for (var i = 0; i < 5; i++)
        {
            var pageLink = siteLink+"/api.php?action=parse&format=json&page=" + pageList[i] + "&prop=templates%7Cwikitext%7Cimages%7Cproperties%7Cparsetree"
            pageInfo.push(await (await fetch(pageLink, this.defaultHeader)).json())
        }
        context.res = {
            status: 200,
            body: {pageList: pageList,
            pageInfo:pageInfo}
        }
    }
}

// Retrieves data from Fandom API's for use in front end Web App to confirm a sites validity and fill in site data
module.exports = async function (context, req) {
    const { CosmosClient } = require("@azure/cosmos");
    const endpoint = "";
    const key = "";
    const client = new CosmosClient({ endpoint, key });

    const databaseId = "WikiData";
    const containerId = "SiteGatheringData";
    const database = client.database(databaseId);
    const container = database.container(containerId);

    context.log('JavaScript HTTP trigger function processed a request.');
    var headers = {method: 'GET', headers: new Headers({"Api-User-Agent": "FandomJsonDataGatherer/1.0 (joelh2003@gmail.com) JavaScript"})}
    var retObject = {}

    const link = "https://"+req.query.site + ".fandom.com"

    var response = await fetch(link, headers)
    retObject.exists = response.ok
    context.log(retObject)
    if (retObject.exists)
    {
        var entry = await container.item(req.query.site, req.query.site).read()
        retObject.hasPage = entry.resource != undefined
        context.log(retObject)


        var Mostlinked = (await (await fetch(link+'/api.php?action=query&list=querypage&qppage=Mostlinked&qplimit=15&format=json')).json()).query.querypage.results
        var MostEdited = (await (await fetch(link+'/api.php?action=query&list=querypage&qppage=Mostrevisions&qplimit=15&format=json')).json()).query.querypage.results
        retObject.pageOptions = []
        for (var i in Mostlinked)
        {
            retObject.pageOptions.push(Mostlinked[i].title)
        }
        for (var i in MostEdited)
        {
            retObject.pageOptions.push(Mostlinked[i].title)
        }
        var response = await fetch(link+"/api.php?action=query&meta=siteinfo&format=json", headers)
        retObject.siteinfo = (await response.json()).query.general
        context.log(retObject)
    }

    context.log(retObject)
    context.res = {
    // status: 200, /* Defaults to 200 */
    body: retObject
    };

    
}

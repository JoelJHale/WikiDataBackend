module.exports = async function (context, req) {
    const { CosmosClient } = require("@azure/cosmos");
    const endpoint = "";
    const key = "";
    const client = new CosmosClient({ endpoint, key });

    const databaseId = "WikiData";
    const containerId = "GatheredData";
    const database = client.database(databaseId);
    const container = database.container(containerId);

    const settingContainerId = "SiteGatheringData";
    const settingContainer = database.container(settingContainerId);

    context.log('JavaScript HTTP trigger function processed a request.');
    context.log(req.query)
    if (req.query.site && req.query.item)
    {
        var id = req.query.site +"__"+ req.query.item
        var cosmosData = await container.item(id, id).read()

        var data = cosmosData.resource
        if (data != undefined)
        {
            context.res = {
                status: 200,
                body: data.data
            };
        }
        else{
            context.res = {
                status: 400,
                body: 'Document not found for site: ' + req.query.site + " | and item: " + req.query.item
            };

        }
    }
    else if (req.query.site)
    {
        var id = req.query.site

        var cosmosData = await settingContainer.item(id, id).read()
        var data = cosmosData.resource
        if (data == undefined)
        {
            context.res = {
                status: 400,
                body: "Couldn't find data for site: " + req.query.site
            };
        }
        else
        {
            var options = []
            for (var option in data.options)
            {
                options.push(option)
            }
            context.res = {
                status: 200,
                body: {name:data.title,options:options}
            };

        }

    }
    else
    {
        var {resources: sqlData} = await settingContainer.items.readAll().fetchAll()
        if (sqlData.length == 0)
        {
            context.res = {
                status: 500,
                body: "Something went wrong and the server was unable to process your request."
            };
        }
        else
        {
            context.res = {
                status: 200,
                body: sqlData
            };

        }

    }
    

}

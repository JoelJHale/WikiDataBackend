// Gives a user view of settings for a given site
module.exports = async function (context, req) {
    const { CosmosClient } = require("@azure/cosmos");
    const endpoint = "";
    const key = "";
    const client = new CosmosClient({ endpoint, key });

    const databaseId = "WikiData";
    const containerId = "SiteGatheringData";
    const database = client.database(databaseId);
    const container = database.container(containerId);
    if (req.query.site)
    {
        var id = req.query.site
        var sqlData = await container.item(id, id).read()
        var data = sqlData.resource
        if (data != undefined)
        {
            context.res = {
                status: 200,
                body: data
            };
            return
        }
        else{
            context.res = {
                status: 400,
                body: 'Document not found for site: ' + req.query.site
            };
            return

        }
    }
    else
    {
        var sqlData = await container.items.readAll().fetchAll()
        var data = sqlData.resources
        context.res = {
            // status: 200, /* Defaults to 200 */
            body: data
        };
    }


}

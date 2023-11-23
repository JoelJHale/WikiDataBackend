module.exports = async function (context, req, inputDocument) {
    const authToken = req.query.userToken;
    const siteToken = req.query.siteToken

  // Temporary filler code to be replaced by secure password managing system before broad release.
    function simpleHash(inStr) {
        var hash = 0;
        if (!inStr || inStr.length === 0) return hash;
        for (var i = 0; i < inStr.length; i++) {
        var chr = inStr.charCodeAt(i);
        hash = ((hash << 5) - hash) + chr;
        hash |= 0; // Convert to 32bit integer
        }
        return hash;
    }

    var hashedToken = simpleHash(authToken)
    if (hashedToken != 446251516)
    {
        context.res = {status: 403, body: 'Invalid authToken (Global Pass Code) for editing settings'}
        return
    }
    if (siteToken == undefined)
    {
        context.res = {status: 400, body: 'Need to have a siteToken in the query defined'}
        return
    }
    if (req.body == null || req.body.object == null)
    {
        context.res = {status: 400, body: 'Need to upload an item as object in the Body' + JSON.stringify(req.body)}
        return
    }
    var item = req.body.object
    item.link = req.query.site
    item.id = req.query.site
    // Setup the connection
    const { CosmosClient } = require("@azure/cosmos");
    const endpoint = "";
    const key = "";
    const client = new CosmosClient({ endpoint, key });

    const databaseId = "WikiData";
    const containerId = "SiteGatheringData";
    const database = client.database(databaseId);
    const container = database.container(containerId);
    var {resource: dbItem} = await (await container.item(item.id, item.id)).read()
    if (dbItem == undefined)
    {
        item.editHash = simpleHash(siteToken)
        for (var i in item.options)
        {
            item.options[i].version = 1
        }
        const { resource: createdItem } = await container.items.create(item);
        context.res = {
            status: 201,
            body: createdItem
        }
    }
    else {
        var siteHash = simpleHash(siteToken)
        if (siteHash != dbItem.editHash) {
            context.res = {status: 403, body: 'Insufficient permissions to edit settings for ' + item.id}
            return
        }
        item.editHash = siteHash
        for (var i in dbItem.options)
        {
            if (item.options[i] == undefined)
            {
                item.options[i] = dbItem.options[i]
            }
            else 
            {
                item.options[i].version = dbItem.options[i].version + 1
            }
        }
        const { resource: createdItem } = await container.item(item.id, item.id).replace(item)
        context.res = {
            status: 200,
            body: createdItem
        }
    }
}

const axios = require("axios");


/*
    Get available Salesforce API versions
*/
async function getSalesforceApiVersion(instanceUrl, accessToken) {

    const response = await axios.get(
        `${instanceUrl}/services/data/`,
        {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        }
    );

    return response.data;
}


/*
    Run a SOQL query
*/
async function querySalesforce(
    instanceUrl,
    accessToken,
    apiVersion,
    soql
) {

    const response = await axios.get(
        `${instanceUrl}/services/data/v${apiVersion}/query`,
        {
            params: {
                q: soql
            },
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        }
    );

    return response.data;
}


/*
    Get the next page of Salesforce query results
*/
async function querySalesforceNext(
    instanceUrl,
    accessToken,
    nextRecordsUrl
) {

    const expectedPrefix =
        `${instanceUrl}/services/data/`;

    if (!nextRecordsUrl.startsWith(expectedPrefix)) {
        throw new Error("Invalid Salesforce pagination URL");
    }

    const response = await axios.get(
        nextRecordsUrl,
        {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        }
    );

    return response.data;
}


/*
    Get one Salesforce record
*/
async function getSalesforceRecord(
    instanceUrl,
    accessToken,
    apiVersion,
    objectName,
    recordId
) {

    const response = await axios.get(
        `${instanceUrl}/services/data/v${apiVersion}/sobjects/${objectName}/${recordId}`,
        {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        }
    );

    return response.data;
}


/*
    Create a Salesforce record
*/
async function createSalesforceRecord(
    instanceUrl,
    accessToken,
    apiVersion,
    objectName,
    recordData
) {

    const response = await axios.post(
        `${instanceUrl}/services/data/v${apiVersion}/sobjects/${objectName}`,
        recordData,
        {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json"
            }
        }
    );

    return response.data;
}


/*
    Update a Salesforce record
*/
async function updateSalesforceRecord(
    instanceUrl,
    accessToken,
    apiVersion,
    objectName,
    recordId,
    recordData
) {

    const response = await axios.patch(
        `${instanceUrl}/services/data/v${apiVersion}/sobjects/${objectName}/${recordId}`,
        recordData,
        {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json"
            }
        }
    );

    return response.data;
}


/*
    Delete a Salesforce record
*/
async function deleteSalesforceRecord(
    instanceUrl,
    accessToken,
    apiVersion,
    objectName,
    recordId
) {

    const response = await axios.delete(
        `${instanceUrl}/services/data/v${apiVersion}/sobjects/${objectName}/${recordId}`,
        {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        }
    );

    return response.data;
}


module.exports = {
    getSalesforceApiVersion,
    querySalesforce,
    querySalesforceNext,
    getSalesforceRecord,
    createSalesforceRecord,
    updateSalesforceRecord,
    deleteSalesforceRecord
};
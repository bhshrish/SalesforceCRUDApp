const express = require("express");
const crypto = require("crypto");

const {
    getSalesforceApiVersion,
    querySalesforce,
    querySalesforceNext,
    getSalesforceRecord,
    createSalesforceRecord,
    updateSalesforceRecord,
    deleteSalesforceRecord
} = require("../services/salesforceApi");

const router = express.Router();


/*
    Salesforce objects allowed by the assignment
*/
const objectFields = {

    Account: [
        "Id",
        "Name",
        "Phone",
        "Website",
        "Industry",
        "Type"
    ],

    Opportunity: [
        "Id",
        "Name",
        "Amount",
        "StageName",
        "CloseDate"
    ],

    Lead: [
        "Id",
        "FirstName",
        "LastName",
        "Company",
        "Email",
        "Phone",
        "Status"
    ],

    Contact: [
        "Id",
        "FirstName",
        "LastName",
        "Email",
        "Phone",
        "AccountId"
    ],

    Case: [
        "Id",
        "CaseNumber",
        "Subject",
        "Status",
        "Priority",
        "Origin"
    ]

};


/*
    Validate Salesforce object
*/
function validateObject(objectName) {

    return Object.prototype.hasOwnProperty.call(
        objectFields,
        objectName
    );
}


/*
    Get encryption key.
*/
function getEncryptionKey() {

    const secret =
        process.env.SESSION_SECRET;

    if (!secret) {

        throw new Error(
            "SESSION_SECRET is not configured"
        );
    }

    return crypto
        .createHash("sha256")
        .update(secret)
        .digest();
}


/*
    Decrypt authentication cookie.
*/
function decryptData(value) {

    try {

        const key =
            getEncryptionKey();

        const parts =
            value.split(".");

        if (parts.length !== 3) {
            return null;
        }

        const iv =
            Buffer.from(
                parts[0],
                "base64url"
            );

        const authTag =
            Buffer.from(
                parts[1],
                "base64url"
            );

        const encrypted =
            Buffer.from(
                parts[2],
                "base64url"
            );

        const decipher =
            crypto.createDecipheriv(
                "aes-256-gcm",
                key,
                iv
            );

        decipher.setAuthTag(
            authTag
        );

        const decrypted =
            Buffer.concat([
                decipher.update(
                    encrypted
                ),
                decipher.final()
            ]);

        return JSON.parse(
            decrypted.toString("utf8")
        );

    } catch (error) {

        console.error(
            "Authentication cookie decryption failed:",
            error.message
        );

        return null;
    }
}


/*
    Get a cookie from the request.
*/
function getCookie(
    req,
    cookieName
) {

    const cookieHeader =
        req.headers.cookie;

    if (!cookieHeader) {
        return null;
    }

    const cookies =
        cookieHeader.split(";");

    for (const cookie of cookies) {

        const separatorIndex =
            cookie.indexOf("=");

        if (separatorIndex === -1) {
            continue;
        }

        const name =
            cookie
                .slice(
                    0,
                    separatorIndex
                )
                .trim();

        if (name !== cookieName) {
            continue;
        }

        return cookie
            .slice(
                separatorIndex + 1
            )
            .trim();
    }

    return null;
}


/*
    Get Salesforce connection.

    The Salesforce authentication
    information is stored inside the
    encrypted HttpOnly cookie.
*/
async function getSalesforceConnection(
    req
) {

    const encryptedAuth =
        getCookie(
            req,
            "salesforce_auth"
        );


    if (!encryptedAuth) {

        throw new Error(
            "Not authenticated with Salesforce"
        );
    }


    const salesforceSession =
        decryptData(
            encryptedAuth
        );


    if (
        !salesforceSession ||
        !salesforceSession.accessToken ||
        !salesforceSession.instanceUrl
    ) {

        throw new Error(
            "Invalid Salesforce authentication"
        );
    }


    const {
        accessToken,
        instanceUrl
    } = salesforceSession;


    const versions =
        await getSalesforceApiVersion(
            instanceUrl,
            accessToken
        );


    const latestVersion =
        versions[
            versions.length - 1
        ].version;


    return {
        accessToken,
        instanceUrl,
        latestVersion
    };
}


/*
    GET
    /api/salesforce/:object

    Get first page of Salesforce records

    Optional:
    /api/salesforce/:object?nextRecordsUrl=...
*/
router.get(
    "/:object",
    async (req, res) => {

        try {

            const { object } =
                req.params;


            if (
                !validateObject(object)
            ) {

                return res
                    .status(400)
                    .json({
                        message:
                            "Invalid Salesforce object"
                    });
            }


            const {
                accessToken,
                instanceUrl,
                latestVersion
            } =
                await getSalesforceConnection(
                    req
                );


            let result;


            /*
                Next page.
            */
            if (
                req.query.nextRecordsUrl
            ) {

                result =
                    await querySalesforceNext(
                        instanceUrl,
                        accessToken,
                        req.query
                            .nextRecordsUrl
                    );

            } else {

                /*
                    First page.
                */
                const fields =
                    objectFields[
                        object
                    ].join(", ");


                const soql = `
                    SELECT ${fields}
                    FROM ${object}
                    ORDER BY CreatedDate DESC
                    LIMIT 20
                `;


                result =
                    await querySalesforce(
                        instanceUrl,
                        accessToken,
                        latestVersion,
                        soql
                    );
            }


            res.json({

                object,

                fields:
                    objectFields[
                        object
                    ],

                count:
                    result.records.length,

                records:
                    result.records,

                nextRecordsUrl:
                    result.nextRecordsUrl ||
                    null,

                done:
                    result.done
            });

        } catch (error) {

            console.error(
                "Salesforce GET records error:",
                error.response?.data ||
                error.message
            );


            res.status(500).json({

                message:
                    "Failed to retrieve Salesforce records",

                error:
                    error.response?.data ||
                    error.message
            });
        }
    }
);


/*
    GET
    /api/salesforce/:object/:id

    Get one Salesforce record
*/
router.get(
    "/:object/:id",
    async (req, res) => {

        try {

            const {
                object,
                id
            } = req.params;


            if (
                !validateObject(object)
            ) {

                return res
                    .status(400)
                    .json({
                        message:
                            "Invalid Salesforce object"
                    });
            }


            const {
                accessToken,
                instanceUrl,
                latestVersion
            } =
                await getSalesforceConnection(
                    req
                );


            const record =
                await getSalesforceRecord(
                    instanceUrl,
                    accessToken,
                    latestVersion,
                    object,
                    id
                );


            res.json({

                object,

                fields:
                    objectFields[
                        object
                    ],

                record
            });

        } catch (error) {

            console.error(
                "Salesforce GET record error:",
                error.response?.data ||
                error.message
            );


            res.status(500).json({

                message:
                    "Failed to retrieve Salesforce record",

                error:
                    error.response?.data ||
                    error.message
            });
        }
    }
);


/*
    POST
    /api/salesforce/:object

    Create Salesforce record
*/
router.post(
    "/:object",
    async (req, res) => {

        try {

            const { object } =
                req.params;


            if (
                !validateObject(object)
            ) {

                return res
                    .status(400)
                    .json({
                        message:
                            "Invalid Salesforce object"
                    });
            }


            if (
                !req.body ||
                Object.keys(req.body).length === 0
            ) {

                return res
                    .status(400)
                    .json({
                        message:
                            "Record data is required"
                    });
            }


            const {
                accessToken,
                instanceUrl,
                latestVersion
            } =
                await getSalesforceConnection(
                    req
                );


            const result =
                await createSalesforceRecord(
                    instanceUrl,
                    accessToken,
                    latestVersion,
                    object,
                    req.body
                );


            res.status(201).json({

                message:
                    `${object} created successfully`,

                result
            });

        } catch (error) {

            console.error(
                "Salesforce CREATE error:",
                error.response?.data ||
                error.message
            );


            res.status(500).json({

                message:
                    `Failed to create Salesforce ${req.params.object}`,

                error:
                    error.response?.data ||
                    error.message
            });
        }
    }
);


/*
    PATCH
    /api/salesforce/:object/:id

    Update Salesforce record
*/
router.patch(
    "/:object/:id",
    async (req, res) => {

        try {

            const {
                object,
                id
            } = req.params;


            if (
                !validateObject(object)
            ) {

                return res
                    .status(400)
                    .json({
                        message:
                            "Invalid Salesforce object"
                    });
            }


            if (
                !req.body ||
                Object.keys(req.body).length === 0
            ) {

                return res
                    .status(400)
                    .json({
                        message:
                            "Update data is required"
                    });
            }


            const {
                accessToken,
                instanceUrl,
                latestVersion
            } =
                await getSalesforceConnection(
                    req
                );


            const result =
                await updateSalesforceRecord(
                    instanceUrl,
                    accessToken,
                    latestVersion,
                    object,
                    id,
                    req.body
                );


            res.json({

                message:
                    `${object} updated successfully`,

                result
            });

        } catch (error) {

            console.error(
                "Salesforce UPDATE error:",
                error.response?.data ||
                error.message
            );


            res.status(500).json({

                message:
                    `Failed to update Salesforce ${req.params.object}`,

                error:
                    error.response?.data ||
                    error.message
            });
        }
    }
);


/*
    DELETE
    /api/salesforce/:object/:id

    Delete Salesforce record
*/
router.delete(
    "/:object/:id",
    async (req, res) => {

        try {

            const {
                object,
                id
            } = req.params;


            if (
                !validateObject(object)
            ) {

                return res
                    .status(400)
                    .json({
                        message:
                            "Invalid Salesforce object"
                    });
            }


            const {
                accessToken,
                instanceUrl,
                latestVersion
            } =
                await getSalesforceConnection(
                    req
                );


            const result =
                await deleteSalesforceRecord(
                    instanceUrl,
                    accessToken,
                    latestVersion,
                    object,
                    id
                );


            res.json({

                message:
                    `${object} deleted successfully`,

                result
            });

        } catch (error) {

            console.error(
                "Salesforce DELETE error:",
                error.response?.data ||
                error.message
            );


            res.status(500).json({

                message:
                    `Failed to delete Salesforce ${req.params.object}`,

                error:
                    error.response?.data ||
                    error.message
            });
        }
    }
);


module.exports = router;
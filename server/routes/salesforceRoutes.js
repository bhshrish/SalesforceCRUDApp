
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

const PAGE_SIZE = 20;

// Salesforce objects and fields
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

// Validate Salesforce object
function validateObject(objectName) {
    return Object.prototype.hasOwnProperty.call(
        objectFields,
        objectName
    );
}

// Encryption key
function getEncryptionKey() {
    const secret = process.env.SESSION_SECRET;

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

// Decrypt authentication cookie
function decryptData(value) {
    try {
        const key = getEncryptionKey();

        const parts = value.split(".");

        if (parts.length !== 3) {
            return null;
        }

        const iv = Buffer.from(
            parts[0],
            "base64url"
        );

        const authTag = Buffer.from(
            parts[1],
            "base64url"
        );

        const encrypted = Buffer.from(
            parts[2],
            "base64url"
        );

        const decipher = crypto.createDecipheriv(
            "aes-256-gcm",
            key,
            iv
        );

        decipher.setAuthTag(authTag);

        const decrypted = Buffer.concat([
            decipher.update(encrypted),
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

// Read cookie
function getCookie(req, cookieName) {
    const cookieHeader = req.headers.cookie;

    if (!cookieHeader) {
        return null;
    }

    const cookies = cookieHeader.split(";");

    for (const cookie of cookies) {
        const separatorIndex = cookie.indexOf("=");

        if (separatorIndex === -1) {
            continue;
        }

        const name = cookie
            .slice(0, separatorIndex)
            .trim();

        if (name !== cookieName) {
            continue;
        }

        return cookie
            .slice(separatorIndex + 1)
            .trim();
    }

    return null;
}

// Get Salesforce connection
async function getSalesforceConnection(req) {
    const encryptedAuth = getCookie(
        req,
        "salesforce_auth"
    );

    if (!encryptedAuth) {
        throw new Error(
            "Not authenticated with Salesforce"
        );
    }

    const salesforceSession = decryptData(
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

    const versions = await getSalesforceApiVersion(
        instanceUrl,
        accessToken
    );

    const latestVersion =
        versions[versions.length - 1].version;

    return {
        accessToken,
        instanceUrl,
        latestVersion
    };
}

// Validate Salesforce pagination cursor
function validateNextRecordsUrl(
    nextRecordsUrl,
    latestVersion
) {
    if (
        typeof nextRecordsUrl !== "string" ||
        nextRecordsUrl.length > 2048
    ) {
        return false;
    }

    // Salesforce cursor must be a relative API path.
    // Reject absolute URLs and unrelated endpoints.
    const prefix =
        `/services/data/v${latestVersion}/query/`;

    if (!nextRecordsUrl.startsWith(prefix)) {
        return false;
    }

    try {
        const parsed = new URL(
            nextRecordsUrl,
            "https://salesforce.invalid"
        );

        return (
            parsed.origin ===
                "https://salesforce.invalid" &&
            parsed.pathname.startsWith(prefix) &&
            !parsed.username &&
            !parsed.password &&
            !parsed.hash
        );
    } catch {
        return false;
    }
}

// GET /api/salesforce/:object
// Returns the first or next Salesforce page.
router.get("/:object", async (req, res) => {
    try {
        const { object } = req.params;

        if (!validateObject(object)) {
            return res.status(400).json({
                message: "Invalid Salesforce object"
            });
        }

        const {
            accessToken,
            instanceUrl,
            latestVersion
        } = await getSalesforceConnection(req);

        let result;

        if (req.query.nextRecordsUrl) {
            const nextRecordsUrl =
                req.query.nextRecordsUrl;

            if (
                !validateNextRecordsUrl(
                    nextRecordsUrl,
                    latestVersion
                )
            ) {
                return res.status(400).json({
                    message:
                        "Invalid Salesforce pagination cursor"
                });
            }

            result = await querySalesforceNext(
                instanceUrl,
                accessToken,
                nextRecordsUrl,
                PAGE_SIZE
            );
        } else {
            const fields =
                objectFields[object].join(", ");

            const soql = `
                SELECT ${fields}
                FROM ${object}
                ORDER BY CreatedDate DESC, Id DESC
            `;

            result = await querySalesforce(
                instanceUrl,
                accessToken,
                latestVersion,
                soql,
                PAGE_SIZE
            );
        }

        return res.json({
            object,
            fields: objectFields[object],
            count: result.records?.length || 0,
            records: result.records || [],
            nextRecordsUrl:
                result.nextRecordsUrl || null,
            done: Boolean(result.done),
            pageSize: PAGE_SIZE
        });
    } catch (error) {
        console.error(
            "Salesforce GET records error:",
            error.response?.data ||
                error.message
        );

        const status =
            error.message ===
                "Not authenticated with Salesforce" ||
            error.message ===
                "Invalid Salesforce authentication"
                ? 401
                : 500;

        return res.status(status).json({
            message:
                status === 401
                    ? "Not authenticated with Salesforce"
                    : "Failed to retrieve Salesforce records",
            error:
                status === 500
                    ? error.response?.data ||
                      error.message
                    : undefined
        });
    }
});

// GET /api/salesforce/:object/:id
// Retrieve a single record.
router.get("/:object/:id", async (req, res) => {
    try {
        const { object, id } = req.params;

        if (!validateObject(object)) {
            return res.status(400).json({
                message: "Invalid Salesforce object"
            });
        }

        const {
            accessToken,
            instanceUrl,
            latestVersion
        } = await getSalesforceConnection(req);

        const record = await getSalesforceRecord(
            instanceUrl,
            accessToken,
            latestVersion,
            object,
            id
        );

        return res.json({
            object,
            fields: objectFields[object],
            record
        });
    } catch (error) {
        console.error(
            "Salesforce GET record error:",
            error.response?.data ||
                error.message
        );

        return res.status(500).json({
            message:
                "Failed to retrieve Salesforce record",
            error:
                error.response?.data ||
                error.message
        });
    }
});

// POST /api/salesforce/:object
// Create a Salesforce record.
router.post("/:object", async (req, res) => {
    try {
        const { object } = req.params;

        if (!validateObject(object)) {
            return res.status(400).json({
                message: "Invalid Salesforce object"
            });
        }

        if (
            !req.body ||
            Object.keys(req.body).length === 0
        ) {
            return res.status(400).json({
                message: "Record data is required"
            });
        }

        const {
            accessToken,
            instanceUrl,
            latestVersion
        } = await getSalesforceConnection(req);

        const result = await createSalesforceRecord(
            instanceUrl,
            accessToken,
            latestVersion,
            object,
            req.body
        );

        return res.status(201).json({
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

        return res.status(500).json({
            message:
                `Failed to create Salesforce ${req.params.object}`,
            error:
                error.response?.data ||
                error.message
        });
    }
});

// PATCH /api/salesforce/:object/:id
// Update a Salesforce record.
router.patch("/:object/:id", async (req, res) => {
    try {
        const { object, id } = req.params;

        if (!validateObject(object)) {
            return res.status(400).json({
                message: "Invalid Salesforce object"
            });
        }

        if (
            !req.body ||
            Object.keys(req.body).length === 0
        ) {
            return res.status(400).json({
                message: "Update data is required"
            });
        }

        const {
            accessToken,
            instanceUrl,
            latestVersion
        } = await getSalesforceConnection(req);

        const result = await updateSalesforceRecord(
            instanceUrl,
            accessToken,
            latestVersion,
            object,
            id,
            req.body
        );

        return res.json({
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

        return res.status(500).json({
            message:
                `Failed to update Salesforce ${req.params.object}`,
            error:
                error.response?.data ||
                error.message
        });
    }
});

// DELETE /api/salesforce/:object/:id
// Delete a Salesforce record.
router.delete("/:object/:id", async (req, res) => {
    try {
        const { object, id } = req.params;

        if (!validateObject(object)) {
            return res.status(400).json({
                message: "Invalid Salesforce object"
            });
        }

        const {
            accessToken,
            instanceUrl,
            latestVersion
        } = await getSalesforceConnection(req);

        const result = await deleteSalesforceRecord(
            instanceUrl,
            accessToken,
            latestVersion,
            object,
            id
        );

        return res.json({
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

        return res.status(500).json({
            message:
                `Failed to delete Salesforce ${req.params.object}`,
            error:
                error.response?.data ||
                error.message
        });
    }
});

module.exports = router;

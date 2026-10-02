const express = require("express");
const axios = require("axios");
const crypto = require("crypto");

const router = express.Router();


/*
    Cookie names
*/
const PKCE_COOKIE =
    "salesforce_pkce";

const AUTH_COOKIE =
    "salesforce_auth";


/*
    Determine whether the application
    is running in production.
*/
function isProduction() {

    return (
        process.env.NODE_ENV ===
        "production"
    );
}


/*
    Get encryption key from SESSION_SECRET.

    SHA-256 converts the session secret
    into a 32-byte key suitable for
    AES-256 encryption.
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
    Encrypt JSON data.
*/
function encryptData(data) {

    const key =
        getEncryptionKey();

    const iv =
        crypto.randomBytes(12);

    const cipher =
        crypto.createCipheriv(
            "aes-256-gcm",
            key,
            iv
        );

    const plaintext =
        JSON.stringify(data);

    const encrypted =
        Buffer.concat([
            cipher.update(
                plaintext,
                "utf8"
            ),
            cipher.final()
        ]);

    const authTag =
        cipher.getAuthTag();

    /*
        Store:

        IV
        Auth Tag
        Encrypted Data
    */
    return [
        iv.toString("base64url"),
        authTag.toString("base64url"),
        encrypted.toString("base64url")
    ].join(".");
}


/*
    Decrypt JSON data.
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
            "Cookie decryption failed:",
            error.message
        );

        return null;
    }
}


/*
    Read a cookie from the request.
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
    Cookie options.
*/
function getCookieOptions() {

    return {
        httpOnly: true,

        secure:
            isProduction(),

        sameSite:
            isProduction()
                ? "lax"
                : "lax",

        path: "/",

        maxAge:
            1000 * 60 * 60 * 24
    };
}


/*
    Generate PKCE code verifier.
*/
function generateCodeVerifier() {

    return crypto
        .randomBytes(64)
        .toString("base64url");
}


/*
    Generate PKCE code challenge.
*/
function generateCodeChallenge(
    codeVerifier
) {

    return crypto
        .createHash("sha256")
        .update(codeVerifier)
        .digest("base64url");
}


/*
    Start Salesforce OAuth
*/
router.get(
    "/salesforce",
    (req, res) => {

        try {

            const codeVerifier =
                generateCodeVerifier();

            const codeChallenge =
                generateCodeChallenge(
                    codeVerifier
                );


            /*
                Store the PKCE verifier
                in an encrypted cookie.

                This replaces the old
                req.session.codeVerifier.
            */
            const encryptedVerifier =
                encryptData({
                    codeVerifier
                });


            res.cookie(
                PKCE_COOKIE,
                encryptedVerifier,
                {
                    ...getCookieOptions(),

                    /*
                        PKCE cookie only needs
                        to survive the OAuth flow.
                    */
                    maxAge:
                        1000 * 60 * 10
                }
            );


            /*
                Salesforce authorization URL.
            */
            const params =
                new URLSearchParams({
                    response_type:
                        "code",

                    client_id:
                        process.env
                            .SALESFORCE_CLIENT_ID,

                    redirect_uri:
                        process.env
                            .SALESFORCE_CALLBACK_URL,

                    code_challenge:
                        codeChallenge,

                    code_challenge_method:
                        "S256"
                });


            const authorizationUrl =
                `${process.env.SALESFORCE_LOGIN_URL}/services/oauth2/authorize?${params.toString()}`;


            res.redirect(
                authorizationUrl
            );

        } catch (error) {

            console.error(
                "Salesforce OAuth start error:",
                error.message
            );

            res.status(500).json({
                message:
                    "Unable to start Salesforce OAuth"
            });
        }
    }
);


/*
    Salesforce OAuth callback
*/
router.get(
    "/salesforce/callback",
    async (req, res) => {

        try {

            const { code } =
                req.query;


            /*
                Salesforce must provide
                an authorization code.
            */
            if (!code) {

                return res
                    .status(400)
                    .json({
                        message:
                            "Authorization code was not provided"
                    });
            }


            /*
                Read encrypted PKCE cookie.
            */
            const encryptedVerifier =
                getCookie(
                    req,
                    PKCE_COOKIE
                );


            if (!encryptedVerifier) {

                return res
                    .status(400)
                    .json({
                        message:
                            "PKCE code verifier was not found"
                    });
            }


            /*
                Decrypt PKCE verifier.
            */
            const pkceData =
                decryptData(
                    encryptedVerifier
                );


            if (
                !pkceData ||
                !pkceData.codeVerifier
            ) {

                return res
                    .status(400)
                    .json({
                        message:
                            "Invalid PKCE code verifier"
                    });
            }


            const codeVerifier =
                pkceData.codeVerifier;


            /*
                Exchange authorization code
                for Salesforce access token.
            */
            const response =
                await axios.post(

                    `${process.env.SALESFORCE_LOGIN_URL}/services/oauth2/token`,

                    new URLSearchParams({

                        grant_type:
                            "authorization_code",

                        code,

                        client_id:
                            process.env
                                .SALESFORCE_CLIENT_ID,

                        client_secret:
                            process.env
                                .SALESFORCE_CLIENT_SECRET,

                        redirect_uri:
                            process.env
                                .SALESFORCE_CALLBACK_URL,

                        code_verifier:
                            codeVerifier
                    }),

                    {
                        headers: {
                            "Content-Type":
                                "application/x-www-form-urlencoded"
                        }
                    }
                );


            const salesforceData =
                response.data;


            console.log(
                "Salesforce OAuth successful"
            );


            /*
                Store Salesforce connection
                information in an encrypted
                HttpOnly cookie.

                This replaces:

                req.session.salesforce
            */
            const encryptedAuth =
                encryptData({

                    accessToken:
                        salesforceData
                            .access_token,

                    refreshToken:
                        salesforceData
                            .refresh_token,

                    instanceUrl:
                        salesforceData
                            .instance_url
                });


            res.cookie(
                AUTH_COOKIE,
                encryptedAuth,
                getCookieOptions()
            );


            /*
                PKCE cookie is no longer needed.
            */
            res.clearCookie(
                PKCE_COOKIE,
                {
                    httpOnly: true,

                    secure:
                        isProduction(),

                    sameSite: "lax",

                    path: "/"
                }
            );


            /*
                Redirect to React application.
            */
            const clientUrl =
                process.env.CLIENT_URL ||
                "http://localhost:5173";


            res.redirect(
                clientUrl
            );

        } catch (error) {

            console.error(
                "Salesforce OAuth error:",
                error.response?.data ||
                error.message
            );

            res.status(500).json({

                message:
                    "Salesforce OAuth failed",

                error:
                    error.response?.data ||
                    error.message
            });
        }
    }
);


/*
    Check whether the user is authenticated.
*/
router.get(
    "/status",
    (req, res) => {

        try {

            const encryptedAuth =
                getCookie(
                    req,
                    AUTH_COOKIE
                );


            if (!encryptedAuth) {

                return res.json({
                    authenticated:
                        false
                });
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

                return res.json({
                    authenticated:
                        false
                });
            }


            res.json({

                authenticated:
                    true,

                instanceUrl:
                    salesforceSession
                        .instanceUrl
            });

        } catch (error) {

            console.error(
                "Authentication status error:",
                error.message
            );

            res.json({
                authenticated:
                    false
            });
        }
    }
);


/*
    Logout
*/
router.get(
    "/logout",
    (req, res) => {

        res.clearCookie(
            AUTH_COOKIE,
            {
                httpOnly: true,

                secure:
                    isProduction(),

                sameSite: "lax",

                path: "/"
            }
        );


        res.clearCookie(
            PKCE_COOKIE,
            {
                httpOnly: true,

                secure:
                    isProduction(),

                sameSite: "lax",

                path: "/"
            }
        );


        res.json({
            message:
                "Logged out successfully"
        });
    }
);


module.exports = router;
const express = require("express");
const axios = require("axios");
const crypto = require("crypto");

const router = express.Router();


/*
    Generate PKCE code verifier
*/
function generateCodeVerifier() {
    return crypto
        .randomBytes(64)
        .toString("base64url");
}


/*
    Generate PKCE code challenge
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
        const codeVerifier =
            generateCodeVerifier();

        const codeChallenge =
            generateCodeChallenge(
                codeVerifier
            );

        /*
            Store PKCE verifier in the
            user's session.
        */
        req.session.codeVerifier =
            codeVerifier;

        const params =
            new URLSearchParams({
                response_type: "code",

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
                Retrieve the PKCE verifier
                created during login.
            */
            const codeVerifier =
                req.session
                    .codeVerifier;

            if (!codeVerifier) {
                return res
                    .status(400)
                    .json({
                        message:
                            "PKCE code verifier was not found"
                    });
            }

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
                information in the session.
            */
            req.session.salesforce = {
                accessToken:
                    salesforceData
                        .access_token,

                refreshToken:
                    salesforceData
                        .refresh_token,

                instanceUrl:
                    salesforceData
                        .instance_url
            };

            /*
                PKCE verifier is no longer
                needed after token exchange.
            */
            delete req.session.codeVerifier;

            /*
                Redirect to the React application.

                Local:
                http://localhost:5173

                Production:
                value from CLIENT_URL
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
    Check whether the user is authenticated
*/
router.get(
    "/status",
    (req, res) => {
        const salesforceSession =
            req.session.salesforce;

        if (!salesforceSession) {
            return res.json({
                authenticated: false
            });
        }

        res.json({
            authenticated: true,

            instanceUrl:
                salesforceSession
                    .instanceUrl
        });
    }
);


/*
    Logout
*/
router.get(
    "/logout",
    (req, res) => {
        req.session.destroy(
            (error) => {
                if (error) {
                    console.error(
                        "Logout error:",
                        error
                    );

                    return res
                        .status(500)
                        .json({
                            message:
                                "Logout failed"
                        });
                }

                res.clearCookie(
                    "connect.sid"
                );

                res.json({
                    message:
                        "Logged out successfully"
                });
            }
        );
    }
);


module.exports = router;
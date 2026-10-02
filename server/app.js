const express = require("express");
const cors = require("cors");
const session = require("express-session");

const authRoutes = require("./routes/authRoutes");
const salesforceRoutes = require("./routes/salesforceRoutes");

const app = express();

const isProduction =
    process.env.NODE_ENV === "production";


/*
    CORS
*/
app.use(
    cors({
        origin: true,
        credentials: true
    })
);


/*
    JSON request body
*/
app.use(express.json());


/*
    Session

    Local:
    - secure = false
    - browser can use HTTP localhost

    Production:
    - secure = true
    - cookie is sent only over HTTPS
*/
app.use(
    session({
        secret: process.env.SESSION_SECRET,

        resave: false,

        saveUninitialized: false,

        cookie: {
            httpOnly: true,

            secure: isProduction,

            sameSite: isProduction
                ? "none"
                : "lax",

            maxAge:
                1000 * 60 * 60 * 24
        }
    })
);


/*
    Local OAuth routes

    Example:
    /auth/salesforce
    /auth/salesforce/callback
    /auth/status
    /auth/logout
*/
app.use(
    "/auth",
    authRoutes
);


/*
    Salesforce API routes

    Example:
    /api/salesforce/Account
    /api/salesforce/Lead
*/
app.use(
    "/api/salesforce",
    salesforceRoutes
);


/*
    Production/API OAuth routes

    Example:
    /api/auth/salesforce
    /api/auth/salesforce/callback
    /api/auth/status
    /api/auth/logout
*/
app.use(
    "/api/auth",
    authRoutes
);


/*
    Health check
*/
app.get("/", (req, res) => {
    res.json({
        message:
            "Salesforce CRUD backend is running"
    });
});


module.exports = app;
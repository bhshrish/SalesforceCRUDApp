const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/authRoutes");
const salesforceRoutes = require("./routes/salesforceRoutes");

const app = express();


/*
    Detect production environment
*/
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
    Authentication routes

    Local:
    /auth/salesforce
    /auth/salesforce/callback
    /auth/status
    /auth/logout

    Production:
    /api/auth/salesforce
    /api/auth/salesforce/callback
    /api/auth/status
    /api/auth/logout
*/
app.use(
    "/auth",
    authRoutes
);

app.use(
    "/api/auth",
    authRoutes
);


/*
    Salesforce API routes

    Examples:
    /api/salesforce/Account
    /api/salesforce/Lead
*/
app.use(
    "/api/salesforce",
    salesforceRoutes
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
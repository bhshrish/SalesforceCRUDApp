const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const session = require("express-session");

const authRoutes = require("./routes/authRoutes");
const salesforceRoutes = require("./routes/salesforceRoutes");

dotenv.config();

const app = express();

app.use(cors({
    origin: "http://localhost:5173",
    credentials: true
}));

app.use(express.json());

app.use(
    session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            secure: false,
            sameSite: "lax"
        }
    })
);

app.use("/auth", authRoutes);
app.use("/api/salesforce", salesforceRoutes);

app.get("/", (req, res) => {
    res.json({
        message: "Salesforce CRUD backend is running"
    });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
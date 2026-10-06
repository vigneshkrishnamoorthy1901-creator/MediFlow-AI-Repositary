const express = require("express");
const cors = require("cors");

const recordsRouter =
    require("./routes/records");

const aiRouter = require("./routes/ai");
const path = require("path");
const fs = require("fs");
fs.mkdirSync(path.join(__dirname, "../uploads"), { recursive: true });

const app =
    express();


const PORT = process.env.PORT || 5000;


app.use(cors());

app.use(
    express.json()
);


app.use(
    "/api/records",
    recordsRouter
);


app.use("/api/ai", aiRouter);
app.use(express.static(path.join(__dirname, "../Frontend")));


app.get(
    "/api/health",
    function (req, res) {

        res.json({

            status:
                "success",

            message:
                "Backend server is healthy."

        });

    }
);


app.listen(
    PORT,
    function () {

        console.log(
            `Server running on http://localhost:${PORT}`
        );

    }
);
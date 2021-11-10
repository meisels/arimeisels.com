import crypto from "crypto";

export default function (app, fetch) {
    function changeStatus(status) {
        const monitors = [ 789169806 ];

        monitors.forEach(async x => {
            const response = await fetch("https://api.uptimerobot.com/v2/editMonitor", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    api_key: req.params.UPTIMEROBOT,
                    id: x,
                    status
                })
            });
         });
    }

    app.get("/stop/:password", async (req, res) => {
        if (req.params.password != process.env.PASSWORD) return;

        await changeStatus(0);
        res.sendStatus(200);
        process.exit();
    });

    app.post("/restart/", async (req, res) => {
        const expectedSignature = "sha1=" +
            crypto.createHmac("sha1", process.env.PASSWORD)
                .update(JSON.stringify(req.body))
                .digest("hex");
    
        const signature = req.headers["x-hub-signature"];
        if (signature == expectedSignature) {
            await changeStatus(0);
            res.sendStatus(200);
            process.exit();
        }
    });

    changeStatus(1);
}
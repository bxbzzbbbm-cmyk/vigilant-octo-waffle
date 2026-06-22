const express = require("express");
const https = require("https");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 5900;

let currentEmail = null;
let currentToken = null;

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;

    const options = {
      hostname: "api.mail.tm",
      path,
      method,
      headers: {
        "Content-Type": "application/json"
      }
    };

    if (token) {
      options.headers.Authorization = `Bearer ${token}`;
    }

    if (data) {
      options.headers["Content-Length"] = Buffer.byteLength(data);
    }

    const req = https.request(options, (res) => {
      let output = "";

      res.on("data", (chunk) => {
        output += chunk;
      });

      res.on("end", () => {
        try {
          resolve(JSON.parse(output));
        } catch {
          resolve({ raw: output });
        }
      });
    });

    req.on("error", reject);

    if (data) req.write(data);

    req.end();
  });
}

/*
GET /api/domains
List all available mail.tm domains
*/
app.get("/api/domains", async (req, res) => {
  try {
    const domains = await request("GET", "/domains?page=1");

    res.json({
      success: true,
      count: domains["hydra:totalItems"] || 0,
      domains: (domains["hydra:member"] || []).map(d => d.domain)
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: String(err)
    });
  }
});

/*
GET /api/create
Create temporary email
Optional:
?domain=example.com
*/
app.get("/api/create", async (req, res) => {
  try {
    const domainList = await request("GET", "/domains?page=1");

    const domains = domainList["hydra:member"] || [];

    if (!domains.length) {
      return res.status(500).json({
        success: false,
        message: "No domains available"
      });
    }

    let domain =
      req.query.domain ||
      domains[Math.floor(Math.random() * domains.length)].domain;

    const username =
      "user" +
      Date.now() +
      Math.floor(Math.random() * 9999);

    const password =
      "pass" +
      Date.now() +
      Math.floor(Math.random() * 9999);

    const address = `${username}@${domain}`;

    const account = await request(
      "POST",
      "/accounts",
      {
        address,
        password
      }
    );

    if (account.code) {
      return res.status(400).json({
        success: false,
        message: account.message
      });
    }

    const tokenData = await request(
      "POST",
      "/token",
      {
        address,
        password
      }
    );

    currentEmail = address;
    currentToken = tokenData.token;

    res.json({
      success: true,
      message: "Temporary email created",
      email: address,
      token: tokenData.token
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: String(err)
    });
  }
});

/*
GET /api/get
Get current email/token
*/
app.get("/api/get", (req, res) => {
  if (!currentEmail) {
    return res.status(404).json({
      success: false,
      message: "No temporary email created"
    });
  }

  res.json({
    success: true,
    email: currentEmail,
    token: currentToken
  });
});

/*
GET /api/check
Inbox messages
*/
app.get("/api/check", async (req, res) => {
  try {
    if (!currentToken) {
      return res.status(404).json({
        success: false,
        message: "No active account"
      });
    }

    const messages = await request(
      "GET",
      "/messages?page=1",
      null,
      currentToken
    );

    res.json({
      success: true,
      email: currentEmail,
      total: messages["hydra:totalItems"] || 0,
      inbox: messages["hydra:member"] || []
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: String(err)
    });
  }
});

/*
GET /api/message/:id
Read full message
*/
app.get("/api/message/:id", async (req, res) => {
  try {
    if (!currentToken) {
      return res.status(404).json({
        success: false,
        message: "No active account"
      });
    }

    const msg = await request(
      "GET",
      `/messages/${req.params.id}`,
      null,
      currentToken
    );

    res.json({
      success: true,
      message: msg
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: String(err)
    });
  }
});

app.get("/", (req, res) => {
  res.send(`
<h1>Mail.tm Temporary Email API</h1>
<ul>
<li>GET /api/domains</li>
<li>GET /api/create</li>
<li>GET /api/create?domain=DOMAIN</li>
<li>GET /api/get</li>
<li>GET /api/check</li>
<li>GET /api/message/:id</li>
</ul>
`);
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("Server running on http://127.0.0.1:5900");
});

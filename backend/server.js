const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");
const dotenv = require("dotenv");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const path = require("path");

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const dbConfig = {
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "online_voting"
};

let db = null;

const otpStore = {};

async function connectDatabase() {
    try {
        db = await mysql.createPool({
            host: dbConfig.host,
            user: dbConfig.user,
            password: dbConfig.password,
            database: dbConfig.database,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });

        await db.query("SELECT 1");

        console.log("MySQL connected successfully!");
    } catch (error) {
        console.error(
            "MySQL connection error:",
            error.message
        );
    }
}

connectDatabase();

app.get("/", function (req, res) {
    res.json({
        message: "Online Voting System Backend is running"
    });
});

// SEND OTP
app.post("/api/send-otp", async function (req, res) {
    try {
        const name = req.body.name;
        const phone = req.body.phone;
        const aadhaar = req.body.aadhar;
        const username = req.body.username;
        const password = req.body.password;

        console.log("Entered username:", JSON.stringify(username));
console.log("Configured username:", JSON.stringify(process.env.ADMIN_USERNAME));
console.log("Admin password configured:", Boolean(process.env.ADMIN_PASSWORD));
console.log("JWT secret configured:", Boolean(process.env.ADMIN_JWT_SECRET)); 

        if (!name || !phone || !aadhaar || !password) {
            return res.status(400).json({
                message: "All fields are required"
            });
        }

        if (!/^[0-9]{10}$/.test(phone)) {
            return res.status(400).json({
                message: "Phone number must contain 10 digits"
            });
        }

        if (!/^[0-9]{12}$/.test(aadhaar)) {
            return res.status(400).json({
                message: "Aadhaar number must contain 12 digits"
            });
        }

        if (!db) {
            return res.status(500).json({
                message: "Database is not connected"
            });
        }

        const [phoneRows] = await db.query(
            "SELECT id FROM users WHERE phone = ? LIMIT 1",
            [phone]
        );

        if (phoneRows.length > 0) {
            return res.status(409).json({
                message: "Phone number is already registered"
            });
        }

        const otp = Math.floor(
            100000 + Math.random() * 900000
        ).toString();

        otpStore[phone] = {
            otp: otp,
            name: name,
            phone: phone,
            aadhaar: aadhaar,
            password: password,
            expiresAt: Date.now() + 5 * 60 * 1000
        };

        console.log("");
        console.log("================================");
        console.log("DEMO OTP");
        console.log("Phone:", phone);
        console.log("OTP:", otp);
        console.log("================================");
        console.log("");

        res.json({
            success: true,
            message: "OTP generated successfully"
        });
    } catch (error) {
        console.error("Send OTP error:", error);

        res.status(500).json({
            message: "Unable to generate OTP"
        });
    }
});

// VERIFY OTP
app.post("/api/verify-otp", async function (req, res) {
    try {
        const phone = req.body.phone;
        const otp = req.body.otp;

        if (!phone || !otp) {
            return res.status(400).json({
                message: "Phone number and OTP are required"
            });
        }

        const storedData = otpStore[phone];

        if (!storedData) {
            return res.status(400).json({
                message: "OTP not found. Please generate a new OTP."
            });
        }

        if (Date.now() > storedData.expiresAt) {
            delete otpStore[phone];

            return res.status(400).json({
                message: "OTP has expired. Please generate a new OTP."
            });
        }

        if (storedData.otp !== otp) {
            return res.status(401).json({
                message: "Invalid OTP"
            });
        }

        if (!db) {
            return res.status(500).json({
                message: "Database is not connected"
            });
        }

        const [phoneRows] = await db.query(
            "SELECT id FROM users WHERE phone = ? LIMIT 1",
            [phone]
        );

        if (phoneRows.length > 0) {
            delete otpStore[phone];

            return res.status(409).json({
                message: "Phone number is already registered"
            });
        }

        const aadharHash = await bcrypt.hash(
            storedData.aadhaar,
            10
        );

        const passwordHash = await bcrypt.hash(
            storedData.password,
            10
        );

        const [result] = await db.query(
            "INSERT INTO users (name, phone, aadhar_hash, password_hash) VALUES (?, ?, ?, ?)",
            [
                storedData.name,
                storedData.phone,
                aadharHash,
                passwordHash
            ]
        );

        delete otpStore[phone];

        res.status(201).json({
            success: true,
            message: "Registration successful",
            userId: result.insertId
        });
    } catch (error) {
        console.error("Verify OTP error:", error);

        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({
                message: "Phone number is already registered"
            });
        }

        res.status(500).json({
            message: "Unable to complete registration"
        });
    }
});

// REGISTER WITHOUT OTP
app.post("/api/register", async function (req, res) {
    try {
        const name = req.body.name;
        const phone = req.body.phone;
        const aadhaar = req.body.aadhaar;
        const password = req.body.password;

        if (!name || !phone || !aadhaar || !password) {
            return res.status(400).json({
                message: "All fields are required"
            });
        }

        if (!/^[0-9]{10}$/.test(phone)) {
            return res.status(400).json({
                message: "Phone number must contain 10 digits"
            });
        }

        if (!/^[0-9]{12}$/.test(aadhaar)) {
            return res.status(400).json({
                message: "Aadhaar number must contain 12 digits"
            });
        }

        if (!db) {
            return res.status(500).json({
                message: "Database is not connected"
            });
        }

        const [phoneRows] = await db.query(
            "SELECT id FROM users WHERE phone = ? LIMIT 1",
            [phone]
        );

        if (phoneRows.length > 0) {
            return res.status(409).json({
                message: "Phone number is already registered"
            });
        }

        const aadharHash = await bcrypt.hash(
            aadhaar,
            10
        );

        const passwordHash = await bcrypt.hash(
            password,
            10
        );

        const [result] = await db.query(
            "INSERT INTO users (name, phone, aadhar_hash, password_hash) VALUES (?, ?, ?, ?)",
            [
                name,
                phone,
                aadharHash,
                passwordHash
            ]
        );

        res.status(201).json({
            success: true,
            message: "Registration successful",
            userId: result.insertId
        });
    } catch (error) {
        console.error("Registration error:", error);

        res.status(500).json({
            message: "Unable to register user"
        });
    }
});

// USER LOGIN
app.post("/api/login", async function (req, res) {
    try {
        const phone = req.body.phone;
        const password = req.body.password;

        if (!phone || !password) {
            return res.status(400).json({
                message: "Phone and password are required"
            });
        }

        if (!db) {
            return res.status(500).json({
                message: "Database is not connected"
            });
        }

        const [rows] = await db.query(
            "SELECT id, name, phone, password_hash FROM users WHERE phone = ? LIMIT 1",
            [phone]
        );

        if (rows.length === 0) {
            return res.status(401).json({
                message: "Invalid phone number or password"
            });
        }

        const user = rows[0];

        const passwordMatch = await bcrypt.compare(
            password,
            user.password_hash
        );

        if (!passwordMatch) {
            return res.status(401).json({
                message: "Invalid phone number or password"
            });
        }

        res.json({
            success: true,
            message: "Login successful",
            user: {
                id: user.id,
                name: user.name,
                phone: user.phone
            }
        });
    } catch (error) {
        console.error("Login error:", error);

        res.status(500).json({
            message: "Unable to login"
        });
    }
});

// GET ELECTIONS
app.get("/api/elections", async function (req, res) {
    try {
        if (!db) {
            return res.status(500).json({
                message: "Database is not connected"
            });
        }

        const [rows] = await db.query(
            "SELECT * FROM elections"
        );

        res.json(rows);
    } catch (error) {
        console.error("Election error:", error);

        res.status(500).json({
            message: "Unable to load elections"
        });
    }
});

// GET CANDIDATES
app.get(
    "/api/candidates/:electionId",
    async function (req, res) {
        try {
            const electionId = Number(req.params.electionId);

            if (!Number.isInteger(electionId) || electionId <= 0) {
                return res.status(400).json({
                    message: "Invalid election ID"
                });
            }

            if (!db) {
                return res.status(500).json({
                    message: "Database is not connected"
                });
            }

            const [rows] = await db.query(
                "SELECT id, election_id, name, party, constituency, education, age, profile FROM candidates WHERE election_id = ? ORDER BY id",
                [electionId]
            );

            res.json(rows);
        } catch (error) {
            console.error("Candidates error:", error);

            res.status(500).json({
                message: "Unable to load candidates"
            });
        }
    }
);

// GET SINGLE CANDIDATE
app.get(
    "/api/candidate/:id",
    async function (req, res) {
        try {
            const candidateId = Number(req.params.id);

            if (!Number.isInteger(candidateId) || candidateId <= 0) {
                return res.status(400).json({
                    message: "Invalid candidate ID"
                });
            }

            if (!db) {
                return res.status(500).json({
                    message: "Database is not connected"
                });
            }

            const [rows] = await db.query(
                "SELECT id, election_id, name, party, constituency, education, age, profile FROM candidates WHERE id = ? LIMIT 1",
                [candidateId]
            );

            if (rows.length === 0) {
                return res.status(404).json({
                    message: "Candidate not found"
                });
            }

            res.json(rows[0]);
        } catch (error) {
            console.error("Candidate error:", error);

            res.status(500).json({
                message: "Unable to load candidate"
            });
        }
    }
);

// AI CANDIDATE ANALYSIS
app.get(
    "/api/candidate/:id/ai-analysis",
    async function (req, res) {
        try {
            const candidateId = Number(req.params.id);

            if (!Number.isInteger(candidateId) || candidateId <= 0) {
                return res.status(400).json({
                    message: "Invalid candidate ID"
                });
            }

            if (!db) {
                return res.status(500).json({
                    message: "Database is not connected"
                });
            }

            const [rows] = await db.query(
                "SELECT name, party, constituency, education, age, profile FROM candidates WHERE id = ? LIMIT 1",
                [candidateId]
            );

            if (rows.length === 0) {
                return res.status(404).json({
                    message: "Candidate not found"
                });
            }

            const candidate = rows[0];

            if (!process.env.OPENAI_API_KEY) {
                return res.status(503).json({
                    message: "AI analysis is currently unavailable."
                });
            }

            const OpenAI = require("openai");

            const openai = new OpenAI({
                apiKey: process.env.OPENAI_API_KEY
            });

            const prompt =
                "Provide a neutral educational analysis of this election candidate. " +
                "Do not persuade the voter. Only summarize the supplied information. " +
                "Candidate name: " + candidate.name +
                ". Party: " + candidate.party +
                ". Constituency: " + candidate.constituency +
                ". Education: " + candidate.education +
                ". Age: " + candidate.age +
                ". Background: " + candidate.profile;

            const completion =
                await openai.chat.completions.create({
                    model: "gpt-4o-mini",
                    messages: [
                        {
                            role: "system",
                            content: "You provide neutral educational election information."
                        },
                        {
                            role: "user",
                            content: prompt
                        }
                    ],
                    max_tokens: 250
                });

            const analysis =
                completion.choices[0].message.content;

            res.json({
                success: true,
                analysis: analysis
            });
        } catch (error) {
            console.error("AI analysis error:", error);

            res.status(500).json({
                message: "AI analysis is currently unavailable."
            });
        }
    }
);
// CAST VOTE
app.post("/api/vote", async function (req, res) {
    try {
        const userId = Number(req.body.userId);
        const candidateId = Number(req.body.candidateId);
        const electionId = Number(req.body.electionId);

        if (
            !Number.isInteger(userId) || userId <= 0 ||
            !Number.isInteger(candidateId) || candidateId <= 0 ||
            !Number.isInteger(electionId) || electionId <= 0
        ) {
            return res.status(400).json({
                message: "Invalid vote information"
            });
        }

        if (!db) {
            return res.status(500).json({
                message: "Database is not connected"
            });
        }

        const [userRows] = await db.query(
            "SELECT id FROM users WHERE id = ? LIMIT 1",
            [userId]
        );

        if (userRows.length === 0) {
            return res.status(401).json({
                message: "Please login before voting"
            });
        }

        const [candidateRows] = await db.query(
            "SELECT id FROM candidates WHERE id = ? AND election_id = ? LIMIT 1",
            [candidateId, electionId]
        );

        if (candidateRows.length === 0) {
            return res.status(400).json({
                message: "Candidate does not belong to this election"
            });
        }

        const [previousVotes] = await db.query(
            "SELECT id FROM votes WHERE user_id = ? AND election_id = ? LIMIT 1",
            [userId, electionId]
        );

        if (previousVotes.length > 0) {
            return res.status(409).json({
                message: "You have already voted in this election"
            });
        }

        await db.query(
            "INSERT INTO votes (user_id, election_id, candidate_id) VALUES (?, ?, ?)",
            [userId, electionId, candidateId]
        );

        res.json({
            success: true,
            message: "Vote recorded successfully"
        });
    } catch (error) {
        console.error("Voting error:", error);

        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({
                message: "You have already voted in this election"
            });
        }

        res.status(500).json({
            message: "Unable to record vote"
        });
    }
});

// VOTE STATUS
app.get(
    "/api/vote/status/:userId/:electionId",
    async function (req, res) {
        try {
            const userId = Number(req.params.userId);
            const electionId = Number(req.params.electionId);

            if (
                !Number.isInteger(userId) || userId <= 0 ||
                !Number.isInteger(electionId) || electionId <= 0
            ) {
                return res.status(400).json({
                    message: "Invalid user or election ID"
                });
            }

            if (!db) {
                return res.status(500).json({
                    message: "Database is not connected"
                });
            }

            const [rows] = await db.query(
                "SELECT id, candidate_id, voted_at FROM votes WHERE user_id = ? AND election_id = ? LIMIT 1",
                [userId, electionId]
            );

            if (rows.length === 0) {
                return res.json({
                    hasVoted: false
                });
            }

            res.json({
                hasVoted: true,
                candidateId: rows[0].candidate_id,
                votedAt: rows[0].voted_at
            });
        } catch (error) {
            console.error("Vote status error:", error);

            res.status(500).json({
                message: "Unable to check vote status"
            });
        }
    }
);

// ADMIN LOGIN
app.post("/api/admin/login", function (req, res) {
    console.log("ADMIN LOGIN ROUTE REACHED");
    try {
        const username = req.body.username;
        const password = req.body.password;
        console.log("Received username:", JSON.stringify(username));
console.log("Configured username:", JSON.stringify(process.env.ADMIN_USERNAME));
console.log("Password configured:", Boolean(process.env.ADMIN_PASSWORD));
console.log("JWT secret configured:", Boolean(process.env.ADMIN_JWT_SECRET));
console.log("Username matches:", username === process.env.ADMIN_USERNAME);
console.log("Password matches:", password === process.env.ADMIN_PASSWORD);

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: "Username and password are required"
            });
        }

        if (
            !process.env.ADMIN_USERNAME ||
            !process.env.ADMIN_PASSWORD ||
            !process.env.ADMIN_JWT_SECRET
        ) {
            console.error("Admin environment settings are missing.");

            return res.status(500).json({
                success: false,
                message: "Admin login is not configured on the server"
            });
        }

        if (
            username !== process.env.ADMIN_USERNAME ||
            password !== process.env.ADMIN_PASSWORD
        ) {
            return res.status(401).json({
                success: false,
                message: "Invalid admin username or password"
            });
        }

        const token = jwt.sign(
            {
                role: "admin",
                username: username
            },
            process.env.ADMIN_JWT_SECRET,
            {
                expiresIn: "1h",
                issuer: "online-voting-system"
            }
        );

        res.json({
            success: true,
            message: "Admin login successful",
            token: token
        });
    } catch (error) {
        console.error("Admin login error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to log in as administrator"
        });
    }
});

// ADMIN AUTHENTICATION MIDDLEWARE
function verifyAdmin(req, res, next) {
    const authorization = req.headers.authorization;

    if (!authorization || !authorization.startsWith("Bearer ")) {
        return res.status(401).json({
            success: false,
            message: "Admin authentication required"
        });
    }

    const token = authorization.slice(7);

    if (!process.env.ADMIN_JWT_SECRET) {
        return res.status(500).json({
            success: false,
            message: "Admin authentication is not configured"
        });
    }

    try {
        const decoded = jwt.verify(
            token,
            process.env.ADMIN_JWT_SECRET,
            {
                issuer: "online-voting-system"
            }
        );

        if (
            decoded.role !== "admin" ||
            decoded.username !== process.env.ADMIN_USERNAME
        ) {
            return res.status(403).json({
                success: false,
                message: "Administrator access denied"
            });
        }

        req.admin = decoded;
        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Admin session is invalid or expired. Please log in again."
        });
    }
}

// ELECTION RESULTS — ADMIN ONLY
app.get(
    "/api/results/:electionId",
    verifyAdmin,
    async function (req, res) {
        try {
            const electionId = Number(req.params.electionId);

            if (!Number.isInteger(electionId) || electionId <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid election ID"
                });
            }

            if (!db) {
                return res.status(500).json({
                    success: false,
                    message: "Database is not connected"
                });
            }

            const [electionRows] = await db.query(
                "SELECT id, name FROM elections WHERE id = ? LIMIT 1",
                [electionId]
            );

            if (electionRows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Election not found"
                });
            }

            const [results] = await db.query(
                `SELECT
                    c.id,
                    c.name,
                    c.party,
                    COUNT(v.id) AS vote_count
                FROM candidates c
                LEFT JOIN votes v
                    ON c.id = v.candidate_id
                    AND v.election_id = ?
                WHERE c.election_id = ?
                GROUP BY c.id, c.name, c.party
                ORDER BY vote_count DESC, c.id ASC`,
                [electionId, electionId]
            );

            const [totalRows] = await db.query(
                "SELECT COUNT(*) AS totalVotes FROM votes WHERE election_id = ?",
                [electionId]
            );

            res.json({
                success: true,
                electionName: electionRows[0].name,
                totalVotes: Number(totalRows[0].totalVotes),
                results: results.map(function (candidate) {
                    return {
                        id: candidate.id,
                        name: candidate.name,
                        party: candidate.party,
                        vote_count: Number(candidate.vote_count)
                    };
                })
            });
        } catch (error) {
            console.error("Results error:", error);

            res.status(500).json({
                success: false,
                message: "Unable to load election results"
            });
        }
    }
);

// START SERVER
const PORT = process.env.PORT || 5000;

app.listen(PORT, function () {
    console.log("Server running on http://localhost:" + PORT);
});
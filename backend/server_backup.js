require("dotenv").config();

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const OpenAI = require("openai");

const db = require("./database/db");

const app = express();


// ==========================================
// OPENAI
// ==========================================

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});


// ==========================================
// MIDDLEWARE
// ==========================================

app.use(cors());
app.use(express.json());


// ==========================================
// HOME / TEST ROUTE
// ==========================================

app.get("/", (req, res) => {

    res.send(
        "Online Voting System Backend is Running"
    );

});


// ==========================================
// REGISTRATION
// ==========================================

app.post("/api/register", async (req, res) => {

    const {
        name,
        phone,
        aadhar,
        password
    } = req.body;


    if (!name || !phone || !aadhar || !password) {

        return res.status(400).json({
            message: "All fields are required"
        });

    }


    if (!/^\d{10}$/.test(phone)) {

        return res.status(400).json({
            message: "Phone number must be exactly 10 digits"
        });

    }


    if (!/^\d{12}$/.test(aadhar)) {

        return res.status(400).json({
            message: "Aadhaar number must be exactly 12 digits"
        });

    }


    try {

        const [existingUser] =
            await db.promise().query(
                "SELECT id FROM users WHERE phone = ?",
                [phone]
            );


        if (existingUser.length > 0) {

            return res.status(409).json({
                message: "Phone number is already registered"
            });

        }


        const aadharHash =
            await bcrypt.hash(aadhar, 10);

        const passwordHash =
            await bcrypt.hash(password, 10);


        await db.promise().query(
            `INSERT INTO users
            (name, phone, aadhar_hash, password_hash)
            VALUES (?, ?, ?, ?)`,
            [
                name,
                phone,
                aadharHash,
                passwordHash
            ]
        );


        res.status(201).json({
            message: "Registration successful"
        });


    } catch (error) {

        console.error(
            "Registration error:",
            error
        );


        res.status(500).json({
            message: "Server error during registration"
        });

    }

});


// ==========================================
// LOGIN
// ==========================================

app.post("/api/login", async (req, res) => {

    const {
        phone,
        password
    } = req.body;


    if (!phone || !password) {

        return res.status(400).json({
            message:
                "Phone number and password are required"
        });

    }


    if (!/^\d{10}$/.test(phone)) {

        return res.status(400).json({
            message:
                "Phone number must be exactly 10 digits"
        });

    }


    try {

        const [users] =
            await db.promise().query(
                "SELECT * FROM users WHERE phone = ?",
                [phone]
            );


        if (users.length === 0) {

            return res.status(401).json({
                message:
                    "Invalid phone number or password"
            });

        }


        const user = users[0];


        const passwordMatch =
            await bcrypt.compare(
                password,
                user.password_hash
            );


        if (!passwordMatch) {

            return res.status(401).json({
                message:
                    "Invalid phone number or password"
            });

        }


        res.status(200).json({

            message: "Login successful",

            user: {

                id: user.id,

                name: user.name,

                phone: user.phone

            }

        });


    } catch (error) {

        console.error(
            "Login error:",
            error
        );


        res.status(500).json({
            message:
                "Server error during login"
        });

    }

});


// ==========================================
// GET ALL ELECTIONS
// ==========================================

app.get("/api/elections", async (req, res) => {

    try {

        const [elections] =
            await db.promise().query(
                `SELECT *
                 FROM elections
                 ORDER BY year DESC`
            );


        res.status(200).json(elections);


    } catch (error) {

        console.error(
            "Election error:",
            error
        );


        res.status(500).json({
            message:
                "Unable to load elections"
        });

    }

});


// ==========================================
// GET CANDIDATES FOR AN ELECTION
// ==========================================

app.get(
    "/api/candidates/:electionId",
    async (req, res) => {

        const electionId =
            req.params.electionId;


        try {

            const [candidates] =
                await db.promise().query(
                    `SELECT *
                     FROM candidates
                     WHERE election_id = ?
                     ORDER BY name`,
                    [electionId]
                );


            res.status(200).json(candidates);


        } catch (error) {

            console.error(
                "Candidate error:",
                error
            );


            res.status(500).json({
                message:
                    "Unable to load candidates"
            });

        }

    }
);


// ==========================================
// GET SINGLE CANDIDATE
// ==========================================

app.get(
    "/api/candidate/:id",
    async (req, res) => {

        const candidateId =
            req.params.id;


        try {

            const [candidates] =
                await db.promise().query(
                    `SELECT *
                     FROM candidates
                     WHERE id = ?`,
                    [candidateId]
                );


            if (candidates.length === 0) {

                return res.status(404).json({
                    message:
                        "Candidate not found"
                });

            }


            res.status(200).json(
                candidates[0]
            );


        } catch (error) {

            console.error(
                "Candidate details error:",
                error
            );


            res.status(500).json({
                message:
                    "Unable to load candidate details"
            });

        }

    }
);


// ==========================================
// AI CANDIDATE ANALYSIS
// ==========================================

app.get(
    "/api/candidate/:id/ai-analysis",
    async (req, res) => {

        const candidateId =
            req.params.id;


        try {

            // ------------------------------
            // GET CANDIDATE FROM DATABASE
            // ------------------------------

            const [candidates] =
                await db.promise().query(
                    `SELECT *
                     FROM candidates
                     WHERE id = ?`,
                    [candidateId]
                );


            if (candidates.length === 0) {

                return res.status(404).json({
                    message:
                        "Candidate not found"
                });

            }


            const candidate =
                candidates[0];


            // ------------------------------
            // CREATE AI REQUEST
            // ------------------------------

            const prompt = `

You are an election-information assistant
for an educational Online Voting System.

Analyze the following political candidate:

Name: ${candidate.name}

Party: ${candidate.party || "Not available"}

Constituency:
${candidate.constituency || "Not available"}

Education:
${candidate.education || "Not available"}

Existing database profile:
${candidate.profile || "Not available"}


TASK:

Provide a neutral, factual and source-aware
candidate information summary.

Include these sections:

1. Political Background

2. Major Publicly Documented Work

3. Election Promises / Key Commitments

4. Evidence of Implementation or Progress

5. Important Limitations or Unverified Claims

6. Sources

IMPORTANT RULES:

- Do not support or oppose the candidate.
- Do not tell the voter who to vote for.
- Do not make claims without evidence.
- Clearly distinguish facts from allegations,
  opinions and unverified claims.
- Prefer official government, election commission,
  parliamentary and reputable news sources.
- If evidence about a promise is unavailable,
  explicitly say that it could not be verified.
- Do not invent sources.
- Use information relevant to the candidate's
  actual constituency and election.
- Present both achievements and limitations
  where reliable evidence exists.

This is an educational project and the result
must not be treated as an official election
record.
`;


            // ------------------------------
            // CALL OPENAI
            // ------------------------------

            const response =
                await openai.responses.create({

                    model: "gpt-5.6",

                    tools: [
                        {
                            type: "web_search"
                        }
                    ],

                    input: prompt

                });


            // ------------------------------
            // SEND RESULT
            // ------------------------------

            res.status(200).json({

                candidate: candidate.name,

                analysis:
                    response.output_text

            });


        } catch (error) {

            console.error(
                "AI analysis error:",
                error
            );


            res.status(500).json({

                message:
                    "Unable to generate AI candidate analysis"

            });

        }

    }
);


// ==========================================
// START SERVER
// ==========================================

const PORT = 5000;


app.listen(PORT, () => {

    console.log(
        `Server running on http://localhost:${PORT}`
    );

});
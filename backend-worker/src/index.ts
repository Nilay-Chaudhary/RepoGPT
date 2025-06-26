import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { indexGithubRepo } from "./indexer.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.post("/index", async (req, res) => {
  const { projectId, githubUrl, githubToken } = req.body;

  res.status(202).json({ status: "queued" });

  try {
    console.log("Indexing repo...");
    await indexGithubRepo(projectId, githubUrl, githubToken);
    console.log("Done indexing");
  } catch (err) {
    console.error("Indexing failed:", err);
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Background worker listening on port ${PORT}`);
});

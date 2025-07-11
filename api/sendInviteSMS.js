// /api/sendInviteSMS.js
import express from "express";
import cors from "cors";
import { config } from "dotenv";
import { Twilio } from "twilio";

config(); // Load .env

const router = express.Router();
router.use(cors());
router.use(express.json());

const twilioClient = new Twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

router.post("/", async (req, res) => {
  try {
    const { phone, uid } = req.body;

    if (!phone || !uid) {
      return res.status(400).send("Missing phone or UID");
    }

    const inviteLink = `https://rw-501.github.io/contenthub/signup?ref=${uid}`;
    const messageBody = `🎉 You've been invited to join ContentHub by a creator!\nJoin now: ${inviteLink}`;

    const result = await twilioClient.messages.create({
      body: messageBody,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phone
    });

    console.log("✅ SMS sent:", result.sid);
    res.send("✅ Invite text sent!");
  } catch (err) {
    console.error("❌ SMS error:", err.message);
    res.status(500).send("❌ Failed to send SMS.");
  }
});

export default router;

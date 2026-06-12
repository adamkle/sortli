require('dotenv').config();
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { Timestamp, FieldValue } = require('firebase-admin/firestore');
const nodemailer = require('nodemailer');

admin.initializeApp();

const db = admin.firestore();

// Create nodemailer transporter
// Retrieve credentials from process.env (or functions config)
const smtpUser = process.env.SMTP_USER || functions.config().smtp?.user;
const smtpPass = process.env.SMTP_PASS || functions.config().smtp?.pass;

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: smtpUser || 'sortli.info@gmail.com',
    pass: smtpPass,
  },
});

/**
 * Callable function: sendVerificationEmail
 * Accepts: { email }
 */
exports.sendVerificationEmail = functions.https.onCall(async (data, context) => {
  const email = data.email;
  if (!email || !/\S+@\S+\.\S+/.test(email)) {
    throw new functions.https.HttpsError('invalid-argument', 'נא לספק כתובת אימייל תקינה.');
  }

  // Check if email already in use
  try {
    await admin.auth().getUserByEmail(email.toLowerCase());
    throw new functions.https.HttpsError('already-exists', 'auth/email-already-in-use');
  } catch (error) {
    if (error.code === 'already-exists') {
      throw error;
    }
    // In local emulator, if auth is not initialized or fails due to credentials, we log a warning and proceed.
    if (process.env.FUNCTIONS_EMULATOR === 'true') {
      console.warn("Emulator Mode: Skipping getUserByEmail check due to error:", error.message);
    } else if (error.code !== 'auth/user-not-found') {
      throw new functions.https.HttpsError('internal', 'שגיאה בבדיקת כתובת אימייל: ' + error.message);
    }
  }

  // Generate 6-digit code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

  try {
    // Store in Firestore: collection 'emailVerifications', doc ID: email
    await db.collection('emailVerifications').doc(email.toLowerCase()).set({
      code,
      expiresAt: Timestamp.fromDate(expiresAt),
      createdAt: FieldValue.serverTimestamp(),
    });

    // Hebrew email HTML / text template
    const mailOptions = {
      from: `"Sortli" <sortli.info@gmail.com>`,
      to: email,
      subject: 'קוד אימות לאפליקציית Sortli 🔄',
      text: `שלום,

תודה שנרשמת לאפליקציית SORTLI!

קוד האימות שלך להשלמת ההרשמה הוא: ${code}
(קוד זה בתוקף ל-10 דקות הקרובות)

Sortli היא האפליקציה המושלמת לעזרה בניהול וסידור רשימות: חלוקה לקבוצות, הגרלות חלוקה סודית (ענק וגמד), קביעת סדר אקראי בצורה הוגנת ועוד...

הפתרון המנצח למורים, מדריכים, מפיקי ימי הולדת, משחקי חברה וארגון קבוצות.

(בקרוב: כאן יצורף לינק לסרטון הדרכה קצר!)

בברכה,
צוות Sortli`,
      html: `
        <div style="direction: rtl; text-align: right; font-family: sans-serif; padding: 25px; border: 1px solid #e2e8f0; border-radius: 16px; max-width: 500px; margin: auto; background-color: #faf9ff; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
          <h2 style="color: #4f46e5; margin-bottom: 20px; text-align: center; font-size: 22px;">תודה שנרשמת לאפליקציית SORTLI! 🔄</h2>
          
          <p style="font-size: 16px; color: #1e1b4b; line-height: 24px; text-align: center; margin-bottom: 8px;">קוד האימות שלך להשלמת ההרשמה הוא:</p>
          
          <div style="text-align: center; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: 900; color: #4f46e5; letter-spacing: 6px; padding: 12px 24px; border: 2px dashed #c7d2fe; border-radius: 12px; background-color: #ffffff; display: inline-block;">
              ${code}
            </span>
          </div>
          <p style="font-size: 13px; color: #64748b; text-align: center; margin-top: -10px; margin-bottom: 24px;">* הקוד בתוקף ל-10 דקות הקרובות בלבד.</p>
          
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          
          <div style="margin-top: 20px;">
            <p style="font-size: 15px; color: #312e81; line-height: 24px; font-weight: 700; margin-bottom: 8px;">קצת על האפליקציה:</p>
            <p style="font-size: 14px; color: #475569; line-height: 22px; margin-bottom: 16px;">
              <strong>Sortli</strong> היא האפליקציה המושלמת לעזרה בניהול וסידור רשימות: חלוקה לקבוצות, הגרלות חלוקה סודית (ענק וגמד), קביעת סדר אקראי בצורה הוגנת ועוד...
            </p>
            <p style="font-size: 14px; color: #475569; line-height: 22px; margin-bottom: 20px;">
              הפתרון המנצח למורים, מדריכים, מפיקי ימי הולדת, משחקי חברה וארגון קבוצות.
            </p>
          </div>
          
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          
          <p style="font-size: 13px; color: #828dfb; text-align: center; font-style: italic; margin-bottom: 12px;">
            (בקרוב: כאן יצורף לינק לסרטון הדרכה קצר!)
          </p>
          <p style="font-size: 11px; color: #94a3b8; text-align: center; margin-top: 16px;">
            נוצר באמצעות אפליקציית Sortli - בחירה הוגנת בסיבובים 🔄
          </p>
        </div>
      `,
    };

    console.log("Email dispatch initiated to:", email);
    if (process.env.FUNCTIONS_EMULATOR === 'true' && (!smtpUser || !smtpPass)) {
      console.log(`\n==========================================\n[EMULATOR] Verification code for ${email} is: ${code}\n==========================================\n`);
      return { success: true };
    }
    await transporter.sendMail(mailOptions);
    console.log("Email dispatched successfully to:", email);
    return { success: true };
  } catch (error) {
    console.error("Nodemailer Error:", error);
    if (process.env.FUNCTIONS_EMULATOR === 'true') {
      console.log(`\n==========================================\n[EMULATOR - nodemailer failed] Verification code for ${email} is: ${code}\n==========================================\n`);
      return { success: true };
    }
    console.error('Error sending verification email:', error);
    throw new functions.https.HttpsError('internal', 'שגיאה בשליחת אימייל האימות: ' + error.message);
  }
});

/**
 * Callable function: verifyCode
 * Accepts: { email, code }
 */
exports.verifyCode = functions.https.onCall(async (data, context) => {
  const email = data.email;
  const code = data.code;

  if (!email || !code) {
    throw new functions.https.HttpsError('invalid-argument', 'אימייל או קוד חסרים.');
  }

  try {
    const docRef = db.collection('emailVerifications').doc(email.toLowerCase());
    const docSnap = await docRef.get();

   if (!docSnap.exists) {
      return { success: false, message: 'קוד אימות לא נמצא' };
    }

    const verificationData = docSnap.data();
    const expiresAt = verificationData.expiresAt.toDate();

    if (expiresAt < new Date()) {
      return { success: false, message: 'פג תוקפו של קוד האימות' };
    }

    if (verificationData.code !== code.trim()) {
      return { success: false, message: 'קוד אימות שגוי' };
    }

    // Code is valid! Delete the record so it can't be reused.
    await docRef.delete();
    return { success: true };
  } catch (error) {
    console.error('Error verifying code:', error);
    throw new functions.https.HttpsError('internal', 'שגיאה באימות הקוד: ' + error.message);
  }
});

/**
 * Auth Trigger: onUserCreated
 * Runs when a user is created in Firebase Auth.
 * Marks emailVerified as true.
 */
exports.onUserCreated = functions.auth.user().onCreate(async (user) => {
  try {
    await admin.auth().updateUser(user.uid, {
      emailVerified: true,
    });
    console.log(`Successfully marked emailVerified: true for user ${user.uid}`);
  } catch (error) {
    console.error(`Failed to mark emailVerified: true for user ${user.uid}:`, error);
  }
});

/**
 * Firestore Trigger: onListCreated
 * Runs when a list document is created. Enforces expiresAt (14 days) and createdAt/updatedAt.
 */
exports.onListCreated = functions.firestore.document('lists/{listId}').onCreate(async (snap, context) => {
  try {
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    await snap.ref.update({
      expiresAt: Timestamp.fromDate(expiresAt),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    console.log(`Successfully set 14-day lifespan for list ${context.params.listId}`);
  } catch (error) {
    console.error(`Failed to initialize list metadata for list ${context.params.listId}:`, error);
  }
});

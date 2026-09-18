/**
 * EmailJS Configuration
 *
 * SETUP STEPS:
 * 1. Create a free account at https://www.emailjs.com/
 * 2. Create an Email Service (Gmail, Outlook, etc.) and note the Service ID
 * 3. Create an Email Template using the HTML from src/lib/emailjs/template.html
 *    - The template must include these variables:
 *      {{to_email}}           - Recipient email address
 *      {{verification_code}}  - 6-digit verification code
 *      {{institution_name}}   - Institution name
 *      {{from_name}}          - Sender name
 *      {{subject}}            - Email subject line
 * 4. Copy your Public Key from Account > API Keys
 * 5. Update the values below or set in .env.local
 */

export const EMAILJS_CONFIG = {
  serviceId: process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID || "service_no0fi4g",
  templateId: process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID || "template_d2292ef",
  publicKey: process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY || "NIHNikz-ok3G96jvm",
};

export const EMAIL_TEMPLATE_PARAMS = {
  to_email: "",
  verification_code: "",
  institution_name: "",
  from_name: "ScholarX - Bangladesh Education Society",
  subject: "Your ScholarX Verification Code",
};

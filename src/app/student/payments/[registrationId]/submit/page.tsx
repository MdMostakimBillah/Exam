"use client";
import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { type StudentSession } from "@/lib/auth/student-auth";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";
import { cn } from "@/lib/utils/helpers";
import {
  ArrowLeft,
  CreditCard,
  Upload,
  AlertCircle,
  CheckCircle,
  Loader2,
  Camera,
  X,
} from "lucide-react";

interface Registration {
  id: string;
  application_id: string;
  student_id: string;
  student_name: string;
  exam_name: string;
  class_name: string;
  payment_amount: number;
  student_payment_status: string;
}

type PaymentMethod = "BKASH" | "ROCKET" | "BANK_TRANSFER" | "CASH";

export default function PaymentSubmitPage() {
  const router = useRouter();
  const params = useParams();
  const registrationId = params.registrationId as string;
  const { theme } = useTheme();
  const { lang: language } = useLang();
  const isDark = theme === "dark";
  const isBn = language === "bn";

  const [student, setStudent] = useState<StudentSession | null>(null);
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState("");

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("BKASH");
  const [paymentDate, setPaymentDate] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [receiptNumber, setReceiptNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [proofImage, setProofImage] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem("scholarx_student_session");
    if (!stored) {
      router.push("/student/login");
      return;
    }
    const parsed = JSON.parse(stored) as StudentSession;
    setStudent(parsed);
    fetchRegistration(parsed.id);
  }, [router, registrationId]);

  const fetchRegistration = async (studentId: string) => {
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("registrations")
      .select("*")
      .eq("id", registrationId)
      .eq("student_id", studentId)
      .single();

    if (data) {
      setRegistration(data as Registration);
      setAmount(String(data.payment_amount || ""));
    } else {
      setError(isBn ? "নিবন্ধন পাওয়া যায়নি" : "Registration not found");
    }
    setLoading(false);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError(isBn ? "ছবির আকার 5MB এর বেশি হতে পারে না" : "Image must be under 5MB");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => setProofImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!student || !registration) return;

    if (!paymentDate || !accountNumber || !receiptNumber || !amount) {
      setError(isBn ? "সব প্রয়োজনীয় ঘর পূরণ করুন" : "Please fill all required fields");
      return;
    }

    setSubmitting(true);
    setError("");

    const supabase = createClient();
    const txId = `TXN-STU-${Date.now().toString(36).toUpperCase()}`;

    // Create payment record
    const { error: paymentError } = await supabase.from("payments").insert({
      transaction_id: txId,
      institution_id: student.institutionId,
      institution_name: student.institutionName,
      exam_id: "",
      exam_name: registration.exam_name,
      student_count: 1,
      amount: Number(amount),
      payment_method: paymentMethod,
      status: "PENDING",
      date: paymentDate,
      registration_id: registration.id,
      student_id: student.id,
      student_name: `${student.firstName} ${student.lastName}`,
      reference: receiptNumber,
      payment_date: paymentDate,
      notes: notes,
      submitted_by_student: true,
      submitted_at: new Date().toISOString(),
      receipt_number: receiptNumber,
      account_number: accountNumber,
      proof_image: proofImage,
    });

    if (paymentError) {
      setError(isBn ? "পেমেন্ট জমা দিতে সমস্যা হয়েছে" : "Failed to submit payment");
      setSubmitting(false);
      return;
    }

    // Update registration student_payment_status
    await supabase
      .from("registrations")
      .update({ student_payment_status: "SUBMITTED" })
      .eq("id", registration.id);

    setSubmitting(false);
    setSubmitted(true);
  };

  if (!mounted || !student) return null;

  const card = isDark
    ? "bg-[#141416] border border-white/[0.06] rounded-xl"
    : "bg-white border border-zinc-200 rounded-xl shadow-sm";
  const inputCls = isDark
    ? "bg-white/[0.04] border-white/[0.08] text-white placeholder:text-zinc-600 focus:border-white/20"
    : "bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400";
  const labelCls = isDark ? "text-zinc-400" : "text-zinc-600";

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto text-center py-12">
        <div className={`${card} p-8`}>
          <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="h-8 w-8 text-green-400" />
          </div>
          <h2 className={`text-lg font-bold mb-2 ${isDark ? "text-white" : "text-zinc-900"}`}>
            {isBn ? "পেমেন্ট জমা হয়েছে!" : "Payment Submitted!"}
          </h2>
          <p className={`text-sm mb-6 ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
            {isBn
              ? "আপনার পেমেন্ট যাচাই করা হচ্ছে। সুপার অ্যাডমিন যাচাই করার পর আপনার নিবন্ধন অনুমোদিত হবে।"
              : "Your payment is under review. The registration will be approved after super admin verification."}
          </p>
          <Link
            href="/student/dashboard"
            className={cn(
              "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              isDark ? "bg-white text-black hover:bg-white/90" : "bg-zinc-900 text-white hover:bg-zinc-800"
            )}
          >
            <ArrowLeft className="h-4 w-4" /> {isBn ? "ড্যাশবোর্ডে ফিরুন" : "Back to Dashboard"}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto">
      <Link
        href="/student/dashboard"
        className={cn(
          "inline-flex items-center gap-1 text-sm mb-4 transition-colors",
          isDark ? "text-zinc-400 hover:text-white" : "text-zinc-500 hover:text-zinc-900"
        )}
      >
        <ArrowLeft className="h-4 w-4" /> {isBn ? "ফিরুন" : "Back"}
      </Link>

      <div className={card}>
        <div className={`px-5 py-4 border-b ${isDark ? "border-white/[0.06]" : "border-zinc-100"}`}>
          <div className="flex items-center gap-2">
            <CreditCard className={`h-4 w-4 ${isDark ? "text-zinc-400" : "text-zinc-500"}`} />
            <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>
              {isBn ? "পেমেন্ট জমা দিন" : "Submit Payment"}
            </h3>
          </div>
        </div>

        <div className="p-5">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className={`h-6 w-6 animate-spin ${isDark ? "text-zinc-400" : "text-zinc-500"}`} />
            </div>
          ) : error && !registration ? (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
              <p className="text-xs text-red-400">{error}</p>
            </div>
          ) : registration ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Registration Info */}
              <div className={`p-3 rounded-lg ${isDark ? "bg-white/[0.02] border border-white/[0.06]" : "bg-zinc-50 border border-zinc-200"}`}>
                <p className={`text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{isBn ? "নিবন্ধন" : "Registration"}</p>
                <p className={`text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>{registration.exam_name}</p>
                <p className={`text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
                  {registration.application_id} &middot; {registration.class_name}
                </p>
              </div>

              {/* Payment Method */}
              <div>
                <label className={`block text-[11px] mb-1.5 font-medium ${labelCls}`}>{isBn ? "পেমেন্ট পদ্ধতি *" : "Payment Method *"}</label>
                <div className="grid grid-cols-2 gap-2">
                  {(["BKASH", "ROCKET", "BANK_TRANSFER", "CASH"] as PaymentMethod[]).map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setPaymentMethod(method)}
                      className={cn(
                        "px-3 py-2 rounded-lg text-[11px] font-medium transition-all border",
                        paymentMethod === method
                          ? isDark
                            ? "bg-white text-black border-white"
                            : "bg-zinc-900 text-white border-zinc-900"
                          : isDark
                            ? "bg-white/[0.04] text-zinc-400 border-white/[0.08] hover:bg-white/[0.08]"
                            : "bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100"
                      )}
                    >
                      {method === "BKASH" ? "bKash" : method === "ROCKET" ? "Rocket" : method === "BANK_TRANSFER" ? (isBn ? "ব্যাংক ট্রান্সফার" : "Bank Transfer") : isBn ? "নগদ" : "Cash"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className={`block text-[11px] mb-1.5 font-medium ${labelCls}`}>{isBn ? "পরিমাণ (৳) *" : "Amount (৳) *"}</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                  required
                  className={cn("w-full h-10 px-3 rounded-lg text-sm outline-none transition-all", inputCls)}
                />
              </div>

              {/* Payment Date */}
              <div>
                <label className={`block text-[11px] mb-1.5 font-medium ${labelCls}`}>{isBn ? "পেমেন্ট তারিখ *" : "Payment Date *"}</label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  required
                  className={cn("w-full h-10 px-3 rounded-lg text-sm outline-none transition-all", inputCls)}
                />
              </div>

              {/* Account Number */}
              <div>
                <label className={`block text-[11px] mb-1.5 font-medium ${labelCls}`}>
                  {paymentMethod === "BKASH" ? "bKash" : paymentMethod === "ROCKET" ? "Rocket" : isBn ? "অ্যাকাউন্ট নম্বর" : "Account Number"} *
                </label>
                <input
                  type="text"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder={isBn ? "অ্যাকাউন্ট নম্বর লিখুন" : "Enter account number"}
                  required
                  className={cn("w-full h-10 px-3 rounded-lg text-sm outline-none transition-all", inputCls)}
                />
              </div>

              {/* Receipt Number */}
              <div>
                <label className={`block text-[11px] mb-1.5 font-medium ${labelCls}`}>{isBn ? "রসিদ/ইনভয়েস নম্বর *" : "Receipt/Invoice Number *"}</label>
                <input
                  type="text"
                  value={receiptNumber}
                  onChange={(e) => setReceiptNumber(e.target.value)}
                  placeholder={isBn ? "রসিদ নম্বর লিখুন" : "Enter receipt number"}
                  required
                  className={cn("w-full h-10 px-3 rounded-lg text-sm outline-none transition-all", inputCls)}
                />
              </div>

              {/* Proof Image */}
              <div>
                <label className={`block text-[11px] mb-1.5 font-medium ${labelCls}`}>{isBn ? "রসিদের ছবি (ঐচ্ছিক)" : "Receipt Screenshot (optional)"}</label>
                <div className="flex items-start gap-3">
                  <div className={cn(
                    "h-20 w-20 rounded-lg flex items-center justify-center shrink-0 overflow-hidden",
                    proofImage ? "" : isDark ? "bg-white/[0.06] border border-white/[0.08]" : "bg-zinc-100 border border-zinc-200"
                  )}>
                    {proofImage ? (
                      <img src={proofImage} alt="Proof" className="h-full w-full object-cover" />
                    ) : (
                      <Camera className={cn("h-5 w-5", isDark ? "text-zinc-600" : "text-zinc-400")} />
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <label className={cn(
                      "inline-flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-medium cursor-pointer transition-colors",
                      isDark ? "bg-white/[0.06] text-zinc-300 hover:bg-white/[0.1]" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                    )}>
                      <Upload className="h-3.5 w-3.5" /> {isBn ? "ছবি আপলোড" : "Upload"}
                      <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                    </label>
                    {proofImage && (
                      <button type="button" onClick={() => setProofImage(null)} className="text-[11px] text-red-400 hover:text-red-300 ml-2">
                        <X className="h-3 w-3 inline" /> {isBn ? "সরান" : "Remove"}
                      </button>
                    )}
                    <p className={`text-[10px] ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>
                      {isBn ? "JPG, PNG। সর্বোচ্চ 5MB।" : "JPG, PNG. Max 5MB."}
                    </p>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className={`block text-[11px] mb-1.5 font-medium ${labelCls}`}>{isBn ? "মন্তব্য (ঐচ্ছিক)" : "Notes (optional)"}</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={isBn ? "অতিরিক্ত তথ্য" : "Additional info"}
                  rows={2}
                  className={cn("w-full px-3 py-2 rounded-lg text-sm outline-none transition-all resize-none", inputCls)}
                />
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                  <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
                  <p className="text-xs text-red-400">{error}</p>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={submitting}
                className={cn(
                  "w-full h-11 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2",
                  isDark ? "bg-white text-black hover:bg-white/90" : "bg-zinc-900 text-white hover:bg-zinc-800",
                  submitting && "opacity-60 cursor-not-allowed"
                )}
              >
                {submitting ? (
                  <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <CreditCard className="h-4 w-4" />
                    {isBn ? "পেমেন্ট জমা দিন" : "Submit Payment"}
                  </>
                )}
              </button>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
}

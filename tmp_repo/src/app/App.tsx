import * as React from "react"
import { useState, useRef, useEffect, forwardRef } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { jsPDF } from "jspdf"
import {
  Calendar, Car, FileText, ClipboardList, CheckSquare, Bell, Newspaper, Activity,
  Send, Search, ChevronDown, ChevronLeft, Plus, Minus, Upload,
  AlertTriangle, CheckCircle, Clock, User, Mail, Fuel,
  ArrowRight, Bot, Check, Wrench, Download, Eye, Printer, Flag, Star,
  Zap, LogOut, Settings, RefreshCw, Hash, MessageSquare,
  Phone, LayoutDashboard, ChevronRight, Menu,
  Wifi, Lightbulb, X, Camera, CameraOff, Mic, Volume2, VolumeX,
  Sun, Moon
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  isFirebaseEnabled,
  fetchChatSessions, 
  fetchChatMessages, 
  saveChatSession, 
  saveChatMessage, 
  deleteChatSession 
} from "./firebaseChat"
import { ensureAuth } from "../firebase"

// ── Types ─────────────────────────────────────────────────────────────────────
type PanelType = "welcome" | "appointments" | "vehicle-history" | "jc-opening" | "all-jobcards" | "tasks" | "notifications" | "service-news" | "my-calls" | "suzuki-connect-form" | "suzuki-connect-advice" | "close-jobcard"

interface Appointment {
  regNo: string; timeSlot: string; serviceType: string; omr: number
  model: string; status: "Not Arrived" | "Arrived" | "In Service" | "JC Opened" | "Completed"
  appType?: string
  regNoDisplay?: string
  date?: string
}
interface VehicleRecord {
  date: string; serviceType: string; mileage: number; dealer: string; jcNo?: string
}
interface JobCard {
  jcNo: string; model: string; regNo: string; serviceType: string
  status: "In Progress" | "Completed" | "Pending" | "OCAS Pending"; date: string; amount: number
}
interface JCDetail {
  jcNo: string; dealer: string; dealerMapCode: string; visitDate: string; gateIn: string
  serviceType: string; billedDate: string; techName: string; pinStatus: string; attendedThrough: string
  remark: string; unauthorizedFitments: string; odometer: number; bay: string; group: string
  paymentMode: string; promisedDate: string; promisedTime: string
  customer: {
    name: string; regNo: string; mobile1: string; mobile2: string; model: string; vin: string
    variant: string; saleDate: string; tvSaleDate: string; fcOkDate: string; address: string
    email: string; state: string; city: string; pinCode: string; customerCategory: string
  }
  amount?: number;
  demands: { sno: number; type: string; code: string; desc: string; voice: string }[]
  labour: { sno: number; code: string; desc: string; qty: number; prnHrs: number; billableType: string; amount: number }[]
  parts: { sno: number; code: string; desc: string; qty: number; price: number; amount: number }[]
  pricing: { scheduledLabour: number; scheduledParts: number; estLabour: number; estParts: number }
}
interface Task { id: string; text: string; time: string; done: boolean; priority: "high" | "medium" | "low" }
interface Notification { id: string; text: string; type: "urgent" | "warning" | "success" | "info"; time: string; read: boolean }
interface Message { id: string; role: "user" | "bot"; text: string; panel?: PanelType; initialData?: Record<string, unknown>; timestamp: Date; isJcStep?: boolean; jcStepCode?: string; }

// ── Mock Data ─────────────────────────────────────────────────────────────────
const APPOINTMENTS: Appointment[] = [
  { regNo: "HR26DS6144", timeSlot: "08:15-08:30", serviceType: "PAID SERVICE", omr: 40002, model: "MARUTI BALENO PETROL", status: "Not Arrived", appType: "", date: "2026-04-16" },
  { regNo: "HR26FN3715", timeSlot: "10:30-10:45", serviceType: "PAID SERVICE", omr: 29998, model: "MARUTI GRAND VITARA Strong Hybrid", status: "Not Arrived", appType: "Service Parts Enquiry", date: "2026-04-16" },
  { regNo: "HR26FN3715-DUP", regNoDisplay: "HR26FN3715", timeSlot: "10:30-10:45", serviceType: "PAID SERVICE", omr: 29998, model: "MARUTI GRAND VITARA Strong Hybrid", status: "Not Arrived", appType: "Service Parts Enquiry", date: "2026-04-16" },
  { regNo: "HR26FK2786", timeSlot: "09:00-09:15", serviceType: "PAID SERVICE", omr: 20000, model: "MARUTI GRAND VITARA Smart Hybrid", status: "Not Arrived", appType: "Referrals", date: "2026-04-16" },
  { regNo: "HR26CW7677", timeSlot: "09:15-09:30", serviceType: "PAID SERVICE", omr: 39998, model: "MARUTI BALENO PETROL", status: "Not Arrived", appType: "Service Parts Enquiry", date: "2026-04-16" },
  { regNo: "HR82C0640", timeSlot: "09:30-09:45", serviceType: "2ND FREE SERVICE", omr: 3000, model: "NEW BALENO CNG", status: "Not Arrived", appType: "", date: "2026-04-16" },
  { regNo: "HR10X2772", timeSlot: "11:45-12:00", serviceType: "3RD FREE SERVICE", omr: 9999, model: "BREZZA S-CNG", status: "Not Arrived", appType: "", date: "2026-04-16" },
]

const VEHICLE_HISTORY: Record<string, { model: string; vin: string; records: VehicleRecord[] }> = {
  "DL6CR1517": {
    model: "MARUTI BALENO PETROL", vin: "MA3FJEB1SND123456",
    records: [
      { date: "30-MAY-2024 09:44", serviceType: "RUNNING REPAIR", mileage: 54321, dealer: "MAGIC AUTO PVT LTD, METRO PARKING-2S(NEXA)", jcNo: "JC25000890" },
      { date: "29-DEC-2023 16:19", serviceType: "RUNNING REPAIR", mileage: 48120, dealer: "PREM MOTORS PVT. LTD., GURGAON-2S(NEXA)", jcNo: "JC24001145" },
      { date: "20-DEC-2023 10:36", serviceType: "BODY REPAIR", mileage: 48105, dealer: "PREM MOTORS PVT. LTD., OPP SECTOR-14-SRV", jcNo: "JC24001090" },
      { date: "19-DEC-2023 16:02", serviceType: "PAID SERVICE", mileage: 48101, dealer: "PREM MOTORS PVT. LTD., GURGAON-2S(NEXA)", jcNo: "JC24001088" },
      { date: "19-JUL-2023 18:04", serviceType: "RUNNING REPAIR", mileage: 37012, dealer: "ORBIT MOTORS PRIVATE LTD, VEDVYAS", jcNo: "JC23000765" },
      { date: "08-MAR-2023 10:29", serviceType: "RUNNING REPAIR", mileage: 36609, dealer: "PREM MOTORS PVT. LTD., GURGAON-2S(NEXA)", jcNo: "JC23000210" },
      { date: "11-AUG-2022 09:43", serviceType: "PAID SERVICE", mileage: 30420, dealer: "PREM MOTORS PVT. LTD., OPP SECTOR-14-SRV", jcNo: "JC22001005" },
      { date: "07-JAN-2022 09:23", serviceType: "RUNNING REPAIR", mileage: 25486, dealer: "PREM MOTORS PVT. LTD., GURGAON-2S(NEXA)", jcNo: "JC22000052" },
    ]
  },
  "HR26DS6144": {
    model: "MARUTI BALENO PETROL", vin: "MA3FJEB1SND789012",
    records: [
      { date: "15-FEB-2026 10:00", serviceType: "PMS", mileage: 39800, dealer: "PREM MOTORS PVT. LTD., GURGAON-2S(NEXA)", jcNo: "JC26000312" },
      { date: "10-SEP-2025 14:30", serviceType: "RUNNING REPAIR", mileage: 32100, dealer: "PREM MOTORS PVT. LTD., GURGAON-2S(NEXA)", jcNo: "JC25001890" },
      { date: "22-APR-2025 09:15", serviceType: "PAID SERVICE", mileage: 28450, dealer: "PREM MOTORS PVT. LTD., GURGAON-2S(NEXA)", jcNo: "JC25000780" },
    ]
  },
}

const JOB_CARDS: JobCard[] = [
  { jcNo: "JH10CK2349", model: "NEW WAGON R 1L PETROL", regNo: "MH10CK2349", serviceType: "PAID SERVICE", status: "In Progress", date: "21-MAY-2026", amount: 3503 },
  { jcNo: "JC26000501", model: "MARUTI BALENO PETROL", regNo: "HR26CW7677", serviceType: "PAID SERVICE", status: "OCAS Pending", date: "21-MAY-2026", amount: 4850 },
  { jcNo: "JC26000499", model: "MARUTI ERTIGA PETROL", regNo: "HR05AB1234", serviceType: "RUNNING REPAIR", status: "In Progress", date: "21-MAY-2026", amount: 2200 },
  { jcNo: "JC26000490", model: "BREZZA S-CNG", regNo: "HR10X2772", serviceType: "3RD FREE SERVICE", status: "Pending", date: "20-MAY-2026", amount: 0 },
  { jcNo: "JC26000445", model: "MARUTI BALENO PETROL", regNo: "DL6CR1517", serviceType: "RUNNING REPAIR", status: "Completed", date: "18-MAY-2026", amount: 5680 },
  { jcNo: "JC26000420", model: "NEW SWIFT PETROL", regNo: "HR26FN1234", serviceType: "PMS", status: "Completed", date: "17-MAY-2026", amount: 3290 },
]

const JC_DETAILS: Record<string, JCDetail> = {
  "JH10CK2349": {
    jcNo: "JH10CK2349", dealer: "PREM MOTORS PVT. LTD., GURGAON-2S(NEXA)", dealerMapCode: "PMG2S001",
    visitDate: "21-MAY-2026", gateIn: "08:42", serviceType: "PAID SERVICE", billedDate: "—",
    techName: "RAJESH KUMAR", pinStatus: "Pinned", attendedThrough: "Service Advisor",
    remark: "Customer reports engine noise on cold start. Check and rectify.",
    unauthorizedFitments: "None", odometer: 40125, bay: "Bay-03", group: "Group-A",
    paymentMode: "Cash", promisedDate: "21-MAY-2026", promisedTime: "17:00",
    customer: {
      name: "AMIT SHARMA", regNo: "MH10CK2349", mobile1: "9876543210", mobile2: "9811234567",
      model: "NEW WAGON R 1L PETROL", vin: "MA3FHEB1SND334521", variant: "VXI AMT",
      saleDate: "12-MAR-2022", tvSaleDate: "12-MAR-2022", fcOkDate: "12-MAR-2030",
      address: "H-42, Sector-14, Gurgaon, Haryana", email: "amit.sharma@email.com",
      state: "HARYANA", city: "GURGAON", pinCode: "122001", customerCategory: "Regular"
    },
    demands: [
      { sno: 1, type: "L", code: "ZE6IL0P", desc: "PMS – 1P 20K", voice: "PMS as per schedule" },
      { sno: 2, type: "P", code: "99000M24120", desc: "Engine Oil 1L Petrol", voice: "Oil change required" },
      { sno: 3, type: "L", code: "ENGN001", desc: "Engine Noise Investigation", voice: "Noise on cold start" },
    ],
    labour: [
      { sno: 1, code: "ZE6IL0P", desc: "PMS – 1P 20K", qty: 1, prnHrs: 1.5, billableType: "Scheduled", amount: 850 },
      { sno: 2, code: "ENGN001", desc: "Engine Noise Check & Rectify", qty: 1, prnHrs: 0.5, billableType: "Running Repair", amount: 350 },
    ],
    parts: [
      { sno: 1, code: "99000M24120-579", desc: "Brake Fluid Petrol", qty: 0.5, price: 185, amount: 93 },
      { sno: 2, code: "09168M14015", desc: "Gasket – Oil Pan Drain Plug", qty: 1, price: 9, amount: 9 },
      { sno: 3, code: "99999MN0W16", desc: "Engine Oil Petrol 2.8L", qty: 2.8, price: 480, amount: 1344 },
      { sno: 4, code: "16510M65L10", desc: "Oil Filter Petrol", qty: 1, price: 94, amount: 94 },
    ],
    pricing: { scheduledLabour: 850, scheduledParts: 1540, estLabour: 1200, estParts: 1540 },
  },
  "JC26000501": {
    jcNo: "JC26000501", dealer: "PREM MOTORS PVT. LTD., GURGAON-2S(NEXA)", dealerMapCode: "PMG2S001",
    visitDate: "21-MAY-2026", gateIn: "09:10", serviceType: "PAID SERVICE", billedDate: "—",
    techName: "SURESH YADAV", pinStatus: "Not Pinned", attendedThrough: "Digital (Suzuki Connect)",
    remark: "OCAS pending – customer needs cost breakup before approval.",
    unauthorizedFitments: "Aftermarket music system", odometer: 39998, bay: "Bay-01", group: "Group-B",
    paymentMode: "UPI", promisedDate: "21-MAY-2026", promisedTime: "18:30",
    customer: {
      name: "PRIYA VERMA", regNo: "HR26CW7677", mobile1: "9654321098", mobile2: "",
      model: "MARUTI BALENO PETROL", vin: "MA3FJEB1SND789012", variant: "ALPHA",
      saleDate: "05-NOV-2021", tvSaleDate: "05-NOV-2021", fcOkDate: "05-NOV-2029",
      address: "C-21, DLF Phase-2, Gurgaon, Haryana", email: "priya.verma@gmail.com",
      state: "HARYANA", city: "GURGAON", pinCode: "122002", customerCategory: "Premium"
    },
    demands: [
      { sno: 1, type: "L", code: "ZE6IL1P", desc: "PMS – 1P 40K", voice: "Due for 40K service" },
      { sno: 2, type: "P", code: "TYRE001", desc: "Front Tyre Replacement", voice: "Tyre worn out" },
      { sno: 3, type: "L", code: "AC001", desc: "AC Filter Cleaning", voice: "AC not cooling properly" },
    ],
    labour: [
      { sno: 1, code: "ZE6IL1P", desc: "PMS – 1P 40K", qty: 1, prnHrs: 2.0, billableType: "Scheduled", amount: 1200 },
      { sno: 2, code: "AC001", desc: "AC Filter Cleaning", qty: 1, prnHrs: 0.5, billableType: "Paid", amount: 400 },
    ],
    parts: [
      { sno: 1, code: "99999MN0W20", desc: "Engine Oil Petrol 3L", qty: 3, price: 480, amount: 1440 },
      { sno: 2, code: "16510M65L10", desc: "Oil Filter Petrol", qty: 1, price: 94, amount: 94 },
      { sno: 3, code: "09168M14015", desc: "Gasket – Oil Pan Drain Plug", qty: 1, price: 9, amount: 9 },
      { sno: 4, code: "AC-FILTER-01", desc: "AC Cabin Filter", qty: 1, price: 650, amount: 650 },
      { sno: 5, code: "WIPER-FR-001", desc: "Wiper Blade Front Pair", qty: 1, price: 457, amount: 457 },
    ],
    pricing: { scheduledLabour: 1200, scheduledParts: 2650, estLabour: 1600, estParts: 2650 },
  },
  "JC26000499": {
    jcNo: "JC26000499", dealer: "PREM MOTORS PVT. LTD., GURGAON-2S(NEXA)", dealerMapCode: "PMG2S001",
    visitDate: "21-MAY-2026", gateIn: "09:45", serviceType: "RUNNING REPAIR", billedDate: "—",
    techName: "MANISH TIWARI", pinStatus: "Pinned", attendedThrough: "Service Advisor",
    remark: "Customer complained of brake vibration and steering pull to left.",
    unauthorizedFitments: "None", odometer: 52100, bay: "Bay-05", group: "Group-C",
    paymentMode: "Card", promisedDate: "21-MAY-2026", promisedTime: "16:00",
    customer: {
      name: "DEEPAK MALHOTRA", regNo: "HR05AB1234", mobile1: "9812345670", mobile2: "9711234560",
      model: "MARUTI ERTIGA PETROL", vin: "MA3GGKB1SND456789", variant: "ZXI+",
      saleDate: "18-JUL-2020", tvSaleDate: "18-JUL-2020", fcOkDate: "18-JUL-2028",
      address: "Plot-8, Sec-57, Gurugram, Haryana", email: "deepak.malhotra@business.com",
      state: "HARYANA", city: "GURUGRAM", pinCode: "122011", customerCategory: "Corporate"
    },
    demands: [
      { sno: 1, type: "L", code: "BRK001", desc: "Brake Disc Inspection & Replacement", voice: "Vibration while braking" },
      { sno: 2, type: "L", code: "STR001", desc: "Wheel Alignment & Balancing", voice: "Car pulls left" },
      { sno: 3, type: "P", code: "BRK-PAD-FR", desc: "Front Brake Pads Replacement", voice: "Squealing sound" },
    ],
    labour: [
      { sno: 1, code: "BRK001", desc: "Brake Disc R&R Front Pair", qty: 1, prnHrs: 1.5, billableType: "Running Repair", amount: 600 },
      { sno: 2, code: "STR001", desc: "4-Wheel Alignment & Balancing", qty: 1, prnHrs: 0.75, billableType: "Paid", amount: 500 },
    ],
    parts: [
      { sno: 1, code: "55200M80J10", desc: "Disc Brake Front LH", qty: 1, price: 485, amount: 485 },
      { sno: 2, code: "55300M80J10", desc: "Disc Brake Front RH", qty: 1, price: 485, amount: 485 },
      { sno: 3, code: "55810M80J10", desc: "Front Brake Pad Set", qty: 1, price: 430, amount: 430 },
    ],
    pricing: { scheduledLabour: 0, scheduledParts: 0, estLabour: 1100, estParts: 1400 },
  },
  "JC26000490": {
    jcNo: "JC26000490", dealer: "PREM MOTORS PVT. LTD., GURGAON-2S(NEXA)", dealerMapCode: "PMG2S001",
    visitDate: "20-MAY-2026", gateIn: "11:30", serviceType: "3RD FREE SERVICE", billedDate: "—",
    techName: "ARUN CHAUHAN", pinStatus: "Not Pinned", attendedThrough: "Digital (Suzuki Connect)",
    remark: "Free service under warranty. Customer also requested CNG kit inspection.",
    unauthorizedFitments: "None", odometer: 9999, bay: "Bay-02", group: "Group-A",
    paymentMode: "NA (Free Service)", promisedDate: "20-MAY-2026", promisedTime: "17:00",
    customer: {
      name: "SUNITA RAWAT", regNo: "HR10X2772", mobile1: "9988776655", mobile2: "",
      model: "BREZZA S-CNG", vin: "MA3GAHB1SND001234", variant: "ZXI CNG",
      saleDate: "10-SEP-2025", tvSaleDate: "10-SEP-2025", fcOkDate: "10-SEP-2033",
      address: "23A, Sec-40, Gurugram, Haryana", email: "sunita.rawat@email.com",
      state: "HARYANA", city: "GURUGRAM", pinCode: "122003", customerCategory: "Regular"
    },
    demands: [
      { sno: 1, type: "L", code: "ZFREE3", desc: "3rd Free Service – 10K", voice: "Due for 3rd free service" },
      { sno: 2, type: "L", code: "CNG001", desc: "CNG Kit Inspection", voice: "CNG kit check requested" },
    ],
    labour: [
      { sno: 1, code: "ZFREE3", desc: "3rd Free Service Check", qty: 1, prnHrs: 1.0, billableType: "Free Service", amount: 0 },
      { sno: 2, code: "CNG001", desc: "CNG Kit General Inspection", qty: 1, prnHrs: 0.5, billableType: "Free Service", amount: 0 },
    ],
    parts: [
      { sno: 1, code: "09168M14015", desc: "Gasket – Oil Pan Drain Plug", qty: 1, price: 9, amount: 0 },
      { sno: 2, code: "16510M65L10", desc: "Oil Filter Petrol/CNG", qty: 1, price: 94, amount: 0 },
    ],
    pricing: { scheduledLabour: 0, scheduledParts: 0, estLabour: 0, estParts: 0 },
  },
  "JC26000445": {
    jcNo: "JC26000445", dealer: "PREM MOTORS PVT. LTD., GURGAON-2S(NEXA)", dealerMapCode: "PMG2S001",
    visitDate: "18-MAY-2026", gateIn: "08:55", serviceType: "RUNNING REPAIR", billedDate: "18-MAY-2026",
    techName: "VIKRAM SINGH", pinStatus: "Pinned", attendedThrough: "Service Advisor",
    remark: "Battery replaced under OCAS approval. Customer informed and signature collected.",
    unauthorizedFitments: "Aftermarket reverse camera", odometer: 54321, bay: "Bay-04", group: "Group-B",
    paymentMode: "UPI", promisedDate: "18-MAY-2026", promisedTime: "15:00",
    customer: {
      name: "RAHUL MEHTA", regNo: "DL6CR1517", mobile1: "9810001122", mobile2: "9560001122",
      model: "MARUTI BALENO PETROL", vin: "MA3FJEB1SND123456", variant: "DELTA",
      saleDate: "15-JAN-2020", tvSaleDate: "15-JAN-2020", fcOkDate: "15-JAN-2028",
      address: "F-15, Green Park Ext., New Delhi", email: "rahul.mehta@gmail.com",
      state: "DELHI", city: "NEW DELHI", pinCode: "110016", customerCategory: "Regular"
    },
    demands: [
      { sno: 1, type: "P", code: "BATT001", desc: "Battery Replacement (55B24LS)", voice: "Car not starting – battery dead" },
      { sno: 2, type: "L", code: "ELEC001", desc: "Electrical System Check", voice: "Check why battery drained" },
    ],
    labour: [
      { sno: 1, code: "ELEC001", desc: "Electrical System Check", qty: 1, prnHrs: 0.5, billableType: "Running Repair", amount: 300 },
      { sno: 2, code: "BATT-FIT", desc: "Battery Fitting Charges", qty: 1, prnHrs: 0.25, billableType: "Running Repair", amount: 200 },
    ],
    parts: [
      { sno: 1, code: "BATT-55B24LS", desc: "Battery 55B24LS Maruti OEM", qty: 1, price: 5180, amount: 5180 },
    ],
    pricing: { scheduledLabour: 0, scheduledParts: 0, estLabour: 500, estParts: 5180 },
  },
  "JC26000420": {
    jcNo: "JC26000420", dealer: "PREM MOTORS PVT. LTD., GURGAON-2S(NEXA)", dealerMapCode: "PMG2S001",
    visitDate: "17-MAY-2026", gateIn: "09:00", serviceType: "PMS", billedDate: "17-MAY-2026",
    techName: "PRAKASH NAIR", pinStatus: "Pinned", attendedThrough: "Digital (Suzuki Connect)",
    remark: "PMS completed. All checks passed. Customer collected vehicle at 16:30.",
    unauthorizedFitments: "None", odometer: 20010, bay: "Bay-06", group: "Group-C",
    paymentMode: "Card", promisedDate: "17-MAY-2026", promisedTime: "16:00",
    customer: {
      name: "NEHA KAPOOR", regNo: "HR26FN1234", mobile1: "9899001122", mobile2: "",
      model: "NEW SWIFT PETROL", vin: "MA3FHDB1SND567890", variant: "ZXI+",
      saleDate: "02-AUG-2024", tvSaleDate: "02-AUG-2024", fcOkDate: "02-AUG-2032",
      address: "D-7, Sec-15, Faridabad, Haryana", email: "neha.kapoor@work.com",
      state: "HARYANA", city: "FARIDABAD", pinCode: "121007", customerCategory: "Premium"
    },
    demands: [
      { sno: 1, type: "L", code: "ZE6IL0P", desc: "PMS – 1P 20K", voice: "Due for 20K service" },
      { sno: 2, type: "P", desc: "Brake Fluid Top-up", code: "BF001", voice: "Routine brake fluid check" },
    ],
    labour: [
      { sno: 1, code: "ZE6IL0P", desc: "PMS – 1P 20K", qty: 1, prnHrs: 1.5, billableType: "Scheduled", amount: 900 },
    ],
    parts: [
      { sno: 1, code: "99999MN0W16", desc: "Engine Oil Petrol 2.5L", qty: 2.5, price: 480, amount: 1200 },
      { sno: 2, code: "16510M65L10", desc: "Oil Filter Petrol", qty: 1, price: 94, amount: 94 },
      { sno: 3, code: "09168M14015", desc: "Gasket – Oil Pan Drain Plug", qty: 1, price: 9, amount: 9 },
      { sno: 4, code: "99000M24120-579", desc: "Brake Fluid Petrol", qty: 0.5, price: 185, amount: 93 },
      { sno: 5, code: "AIR-FILTER-SW", desc: "Air Filter Swift", qty: 1, price: 394, amount: 394 },
      { sno: 6, code: "SPARK-01", desc: "Spark Plug (Set of 3)", qty: 1, price: 600, amount: 600 },
    ],
    pricing: { scheduledLabour: 900, scheduledParts: 2390, estLabour: 900, estParts: 2390 },
  },
}

const TASKS_DATA: Task[] = [
  { id: "t1", text: "Call HR26FN3715 — Customer hasn't confirmed arrival", time: "09:00", done: false, priority: "high" },
  { id: "t2", text: "Send OCAS approval for JH10CK2349", time: "10:00", done: false, priority: "high" },
  { id: "t3", text: "Follow up on parts availability for HR05AB1234", time: "11:00", done: false, priority: "medium" },
  { id: "t4", text: "Morning vehicle inventory check", time: "08:00", done: true, priority: "low" },
  { id: "t5", text: "Submit warranty claim for JC26000445", time: "14:00", done: false, priority: "medium" },
  { id: "t6", text: "Service news briefing with team", time: "15:30", done: false, priority: "low" },
  { id: "t7", text: "Customer feedback call — BREZZA owner", time: "16:00", done: false, priority: "low" },
]

const NOTIFS_DATA: Notification[] = [
  { id: "n1", text: "URGENT: Customer HR26CW7677 waiting in lounge — Bay still occupied", type: "urgent", time: "10 min ago", read: false },
  { id: "n2", text: "Parts pending for JH10CK2349 — Engine Oil filter (2 units) out of stock", type: "warning", time: "25 min ago", read: false },
  { id: "n3", text: "OCAS approved for JC26000445 — Authorized by Madan Kumar", type: "success", time: "1 hr ago", read: false },
  { id: "n4", text: "New appointment booked: MH01HK4521 — 28-MAY-2026 10:00 AM", type: "info", time: "2 hrs ago", read: true },
  { id: "n5", text: "Tyre replacement reminder: HR26FN3715 — Tyre health critical (2mm)", type: "warning", time: "3 hrs ago", read: true },
  { id: "n6", text: "OCAS submitted for JH10CK2349 — Awaiting customer approval", type: "info", time: "3 hrs ago", read: true },
]

let globalNotifs: Notification[] = (() => {
  try {
    const raw = localStorage.getItem("nexa_notifications")
    return raw ? JSON.parse(raw) : [...NOTIFS_DATA]
  } catch (e) {
    return [...NOTIFS_DATA]
  }
})();
const listeners = new Set<() => void>();

export function useSharedNotifications() {
  const [notifs, setNotifsState] = useState<Notification[]>(globalNotifs);

  useEffect(() => {
    const handler = () => {
      setNotifsState([...globalNotifs]);
    };
    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  }, []);

  const setNotifs = (newNotifs: Notification[] | ((prev: Notification[]) => Notification[])) => {
    if (typeof newNotifs === "function") {
      globalNotifs = newNotifs(globalNotifs);
    } else {
      globalNotifs = newNotifs;
    }
    try {
      localStorage.setItem("nexa_notifications", JSON.stringify(globalNotifs));
    } catch (e) {}
    listeners.forEach(l => l());
  };

  return [notifs, setNotifs] as const;
}

const SERVICE_NEWS = [
  { id: "sn1", title: "Jimny Front Suspension Inspection Campaign", date: "20-MAY-2026", category: "Campaign", summary: "Mandatory inspection for all Jimny models (2023–2024). Complete before 30-JUN-2026." },
  { id: "sn2", title: "Suzuki Connect 2.0 Training Mandatory", date: "19-MAY-2026", category: "Training", summary: "All Service Advisors must complete Suzuki Connect 2.0 training by 31-MAY-2026." },
  { id: "sn3", title: "PMS Package Update — June 2026", date: "15-MAY-2026", category: "Update", summary: "Updated labor rates and parts pricing effective from 01-JUN-2026. Download new rate card." },
]

const JC_DEMANDS = [
  { type: "L", desc: "PMS – 1P 20K", code: "ZE6IL0P", qty: 1, price: 2390, accepted: true },
  { type: "P", desc: "Brake Fluid Petrol", code: "99000M24120-579", qty: 0.5, price: 185, accepted: true },
  { type: "P", desc: "Gasket – Oil Pan Drain Plug Petrol", code: "09168M14015", qty: 1, price: 9, accepted: true },
  { type: "P", desc: "Engine Oil Petrol", code: "99999MN0W16-IDT", qty: 2.8, price: 1344, accepted: true },
  { type: "P", desc: "Oil Filter Petrol", code: "16510M65L10", qty: 1, price: 94, accepted: true },
]

// ── Utilities ─────────────────────────────────────────────────────────────────
function statusBadge(status: string) {
  const map: Record<string, string> = {
    "Not Arrived": "bg-card text-muted-foreground border border-border",
    "Arrived": "bg-[#0D2E1A] text-[#4ADE80] border border-[#4ADE80]/20",
    "In Service": "bg-[#1A1A0D] text-[#FACC15] border border-[#FACC15]/20",
    "JC Opened": "bg-[#0D1E3A] text-[#60A5FA] border border-[#60A5FA]/20",
    "Completed": "bg-[#0D1F2A] text-[#22D3EE] border border-[#22D3EE]/20",
    "In Progress": "bg-[#1A1A0D] text-[#FACC15] border border-[#FACC15]/20",
    "OCAS Pending": "bg-[#2A0D0D] text-[#F87171] border border-[#F87171]/20",
    "Pending": "bg-card text-muted-foreground border border-border",
  }
  return map[status] || "bg-muted text-muted-foreground"
}

function priorityColor(p: string) {
  return p === "high" ? "bg-[#F87171]/20 text-[#F87171]" : p === "medium" ? "bg-[#FACC15]/20 text-[#FACC15]" : "bg-[#6A8FAB]/20 text-muted-foreground"
}

function notifStyle(type: string) {
  const styles: Record<string, { border: string; icon: string; bg: string }> = {
    urgent: { border: "border-l-[#F87171]", icon: "text-[#F87171]", bg: "bg-[#2A0D0D]/40" },
    warning: { border: "border-l-[#FACC15]", icon: "text-[#FACC15]", bg: "bg-[#2A1A0D]/40" },
    success: { border: "border-l-[#4ADE80]", icon: "text-[#4ADE80]", bg: "bg-[#0D2E1A]/40" },
    info: { border: "border-l-[#3D8EF0]", icon: "text-primary", bg: "bg-[#0D1626]/40" },
  }
  return styles[type] || styles.info
}

function parseInput(input: string): { panel: PanelType | null; botText: string } {
  const lower = input.toLowerCase()
  if (/appointment|schedule|booking|my appointment/.test(lower))
    return { panel: "appointments", botText: "Here are your appointments for today, 21-May-2026. You have 7 scheduled visits." }
  if (/vehicle history|service history|check history|history|past service/.test(lower))
    return { panel: "vehicle-history", botText: "Enter a registration number or VIN to pull the complete vehicle service history." }
  if (/open job card|new jc|create jc|open jc|jc opening|start job|new job/.test(lower))
    return { panel: "jc-opening", botText: "Starting the Job Card Opening process. Please scan or enter the vehicle registration number." }
  if (/all job cards|my jobcards|jobcards|all jc|job card list/.test(lower))
    return { panel: "all-jobcards", botText: "Here are all your active and recent Job Cards." }
  if (/task|to-do|my tasks|today task/.test(lower))
    return { panel: "tasks", botText: "Here are your tasks for today, 21-May-2026. You have 6 pending items." }
  if (/notification|alert|update/.test(lower))
    return { panel: "notifications", botText: "You have 3 unread notifications — including 1 urgent." }
  if (/service news|news|bulletin|campaign/.test(lower))
    return { panel: "service-news", botText: "Latest service news, campaigns, and updates from NEXA." }
  return {
    panel: null,
    botText: "I can help you with appointments, vehicle history, job cards, tasks, and notifications. You can also use the quick action buttons above to get started quickly."
  }
}

// ── Welcome Panel ─────────────────────────────────────────────────────────────
function WelcomePanel({ onAction }: { onAction: (a: PanelType) => void }) {
  const [notifs] = useSharedNotifications();
  const unreadCount = notifs.filter(n => !n.read).length;

  const topTiles = [
    { id: "appointments" as PanelType, icon: Calendar, label: "All Appointments", count: "7 Today", color: "#3D8EF0" },
    { id: "notifications" as PanelType, icon: Bell, label: "My Notifications", count: `${unreadCount} Unread`, color: "#F87171", badge: unreadCount },
    { id: "all-jobcards" as PanelType, icon: ClipboardList, label: "All Jobcards", count: "6 Active", color: "#FACC15" },

    { id: "my-calls" as PanelType, icon: Phone, label: "All Calls", count: "2 Missed", color: "#4ADE80" },
    { id: "vehicle-history" as PanelType, icon: Car, label: "Vehicle History", count: "Search", color: "#0DCAF0" },
    { id: "tasks" as PanelType, icon: CheckSquare, label: "Tasks For Today", count: "6 Pending", color: "#A78BFA" },
    
    { id: "suzuki-connect-form" as PanelType, icon: Car, iconBadge: Wifi, label: "Suzuki Connect", count: "Form", color: "#38BDF8" },
    { id: "suzuki-connect-advice" as PanelType, icon: Car, iconBadge: Wifi, label: "Suzuki Connect", count: "Advice", color: "#38BDF8" },
    { id: "jc-opening" as PanelType, icon: FileText, label: "Open Job Card", count: "New JC", color: "#34D399" },
  ]

  return (
    <div className="flex flex-col h-full rounded-2xl border border-border bg-card overflow-hidden">
      <div className="relative flex-1 p-6 flex flex-col justify-center">

        <div className="grid grid-cols-3 gap-y-12 relative z-10">
          {topTiles.map((t, i) => (
            <motion.button
              key={i}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => onAction(t.id)}
              className="flex flex-col items-center justify-center gap-3 p-4 hover:bg-card/50 transition-all rounded-xl relative group mx-auto w-full max-w-[160px]"
            >
              <div className="p-3.5 rounded-xl relative transition-transform group-hover:scale-110" style={{ backgroundColor: `${t.color}15`, color: t.color }}>
                <t.icon size={26} strokeWidth={1.5} />
                {t.iconBadge && (
                  <div className="absolute -top-1.5 -right-2 text-primary opacity-80">
                    <t.iconBadge size={16} strokeWidth={3} />
                  </div>
                )}
                {t.badge !== undefined && t.badge > 0 && (
                  <div className="absolute -top-1.5 -right-1.5 bg-[#F87171] text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full shadow-md">
                    {t.badge}
                  </div>
                )}
              </div>
              <div className="text-center">
                <p className="text-[13px] font-semibold text-foreground font-sans tracking-wide whitespace-nowrap">{t.label}</p>
                <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{t.count}</p>
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      <div className="bg-[#0b101a]/80 border-t border-border/50 p-4 mt-auto">
        <div className="flex items-center justify-between mx-4 relative">
          <button 
            onClick={() => onAction("service-news")}
            className="px-6 py-2 bg-transparent border border-[#555] text-[#ccc] text-[11px] font-bold tracking-widest uppercase hover:bg-[#3D8EF0]/20 hover:border-[#3D8EF0]/50 hover:text-white transition-all cursor-pointer relative z-10"
          >
            VIEW ALL
          </button>
          <p className="text-muted-foreground text-[10px] uppercase tracking-[0.2em] font-bold absolute left-1/2 -translate-x-[50%]">Service News</p>
        </div>
      </div>
    </div>
  )
}

// ── Appointments Panel ────────────────────────────────────────────────────────
function AppointmentsPanel({ onAction }: { onAction: (a: PanelType, data?: Record<string, unknown>) => void }) {
  const [view, setView] = useState<"DAY" | "WEEK" | "MONTH">("DAY")
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<Appointment | null>(null)
  const [appointmentsList, setAppointmentsList] = useState<Appointment[]>(() => {
    try {
      const cached = localStorage.getItem("nexa_appointments")
      return cached ? JSON.parse(cached) : APPOINTMENTS
    } catch (e) {
      return APPOINTMENTS
    }
  })

  useEffect(() => {
    localStorage.setItem("nexa_appointments", JSON.stringify(appointmentsList))
  }, [appointmentsList])

  const [showAddPopup, setShowAddPopup] = useState(false)
  const [selectedDate, setSelectedDate] = useState("2026-04-16")
  const dateInputRef = useRef<HTMLInputElement>(null)

  // ── SMS Flow State ────────────────────────────────────────────────────────
  const [smsApp, setSmsApp] = useState<Appointment | null>(null)
  const [smsLoading, setSmsLoading] = useState(false)
  const [smsSuccess, setSmsSuccess] = useState(false)
  const [smsText, setSmsText] = useState("")
  const [smsPhone, setSmsPhone] = useState("")
  const [smsClientName, setSmsClientName] = useState("")
  const [selectedTemplate, setSelectedTemplate] = useState("reminder")

  const getContactInfo = (regNo: string) => {
    const map: Record<string, { name: string; phone: string }> = {
      "HR26DS6144": { name: "PREM MOTORS", phone: "+91 87084 67728" },
      "HR26FN3715": { name: "AMIT SHARMA", phone: "+91 99100 22345" },
      "HR26FN3715-DUP": { name: "AMIT SHARMA", phone: "+91 99100 22345" },
      "HR26FK2786": { name: "ROHIT MEHTA", phone: "+91 98112 34567" },
      "HR26CW7677": { name: "VIKRAM JOSHI", phone: "+91 95600 98765" },
      "HR82C0640": { name: "SANJEEV SURI", phone: "+91 88001 23456" },
      "HR10X2772": { name: "ANIL GUPTA", phone: "+91 90135 79246" },
    }
    return map[regNo] || { name: "VALUED NEXA CLIENT", phone: "+91 99999 88888" }
  }

  const openSmsModal = (a: Appointment) => {
    const contact = getContactInfo(a.regNoDisplay || a.regNo)
    setSmsApp(a)
    setSmsPhone(contact.phone)
    setSmsClientName(contact.name)
    setSmsSuccess(false)
    setSmsLoading(false)
    const displayReg = a.regNoDisplay || a.regNo
    setSmsText(`Dear NEXA Patron, this is to remind you about your upcoming ${a.serviceType} appointment for ${a.model} (${displayReg}) today at ${a.timeSlot}. Thank you. - Nexa Care`)
    setSelectedTemplate("reminder")
  }

  const handleTemplateChange = (a: Appointment, type: string) => {
    setSelectedTemplate(type)
    const displayReg = a.regNoDisplay || a.regNo
    if (type === "reminder") {
      setSmsText(`Dear NEXA Patron, this is to remind you about your upcoming ${a.serviceType} appointment for ${a.model} (${displayReg}) today at ${a.timeSlot}. Thank you. - Nexa Care`)
    } else if (type === "ready") {
      setSmsText(`Dear NEXA Customer, good news! Your vehicle ${a.model} (${displayReg}) is serviced & ready. Odometer: ${a.omr.toLocaleString()} KMS. Welcome back to NEXA.`)
    } else if (type === "parts") {
      setSmsText(`Dear NEXA Patron, your Service Parts enquiry status is updated for ${a.model}. Required items have arrived at our workshop. Regards, Nexa Service.`)
    } else {
      setSmsText(`Dear Patron, regarding your booking at Nexa Workshop for ${a.model} (${displayReg}). Please consult with our Service Manager. Call +91 87084 67728.`)
    }
  }

  const sendSmsTrigger = async () => {
    setSmsLoading(true)
    await new Promise(r => setTimeout(r, 1400))
    setSmsLoading(false)
    setSmsSuccess(true)
    setTimeout(() => {
      setSmsApp(null)
    }, 1800)
  }
  
  const [formData, setFormData] = useState({
    regNo: "HR26DS6144",
    date1: "16-APR-2026 00:00",
    date2: "21-May-2026 16:27",
    lastAttendedSm: "PARVEEN KUMAR",
    currentSm: "VISHAL YADAV",
    slot: "08:15–08:30",
    timeSlot: "08:15–08:30",
    remarks: "call later",
    omr: "40002",
    serviceType: "PAID SERVICE",
    model: "MARUTI BALENO PETROL",
    variant: "MARUTI BALENO ZETA PETROL",
    vin: "MBHEWB22SJJ223312",
    customerCategory: "N/A",
    customerName: "PREM MOTORS TRUE VALUE",
    mobile1: "8708 467 728",
    mobile2: "N/A",
    email: "ab@123gmail.com",
    address: "SECTOR - 17-18",
    state: "HARYANA",
    city: "GURUGRAM"
  })

  const filtered = appointmentsList.filter(a => {
    const matchesSearch = a.regNo.toLowerCase().includes(search.toLowerCase()) ||
                          a.model.toLowerCase().includes(search.toLowerCase())
    const appDate = a.date || "2026-04-16"
    return matchesSearch && appDate === selectedDate
  })

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const newApp: Appointment = {
      regNo: formData.regNo.toUpperCase() || "HR26DS6144",
      timeSlot: formData.slot || "08:15–08:30",
      serviceType: formData.serviceType || "PAID SERVICE",
      omr: parseInt(formData.omr) || 40002,
      model: formData.model || "MARUTI BALENO PETROL",
      status: "Not Arrived",
      appType: "Service Parts Enquiry",
      date: selectedDate
    }
    setAppointmentsList(prev => [newApp, ...prev])
    setShowAddPopup(false)
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card overflow-hidden">
      {/* ── Black Banner Header ── */}
      <div className="bg-background py-2.5 px-4 flex items-center justify-between text-white font-sans border-b border-border">
        <div className="text-[12px] sm:text-[13px] font-semibold tracking-wider uppercase text-muted-foreground font-sans">
          My Appointments
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-card/60 px-2 py-1 rounded-md border border-border focus-within:border-primary/40 transition-all">
            <Search size={11} className="text-muted-foreground/50" />
            <input 
              type="text" 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              placeholder="Search by Reg No."
              className="bg-transparent text-white text-[11px] w-[90px] sm:w-[130px] outline-none placeholder-neutral-600 font-medium font-sans" 
            />
          </div>
          
          <button
            onClick={() => onAction("jc-opening")}
            className="px-2.5 py-1 bg-primary text-primary-foreground text-[10px] font-extrabold uppercase tracking-widest rounded-md hover:bg-primary/95 transition-all shadow-sm active:scale-95 flex items-center gap-1 cursor-pointer whitespace-nowrap"
            title="Create/Open a New Job Card"
          >
            <Plus size={11} className="stroke-[3px]" />
            <span>Open JC</span>
          </button>

          <button 
            onClick={() => setShowAddPopup(true)} 
            className="text-white hover:text-primary hover:bg-card/85 transition-colors text-[18px] font-semibold px-2 py-0.5 border border-border rounded-md bg-card/40 flex items-center justify-center cursor-pointer"
            title="Schedule a New Appointment"
          >
            +
          </button>
        </div>
      </div>

      {/* ── Subheader Bar: Date selector & DAY/WEEK/MONTH pill switcher ── */}
      <div className="bg-card px-4 py-2.5 flex items-center justify-between border-b border-border">
        {/* Date Selector */}
        {(() => {
          const formatDateDisplay = (dateStr: string) => {
            try {
              const parts = dateStr.split("-")
              if (parts.length !== 3) return dateStr
              const year = parts[0]
              const monthIdx = parseInt(parts[1], 10) - 1
              const day = parseInt(parts[2], 10)
              const months = [
                "January", "February", "March", "April", "May", "June",
                "July", "August", "September", "October", "November", "December"
              ]
              return `${day}-${months[monthIdx] || "April"}-${year}`
            } catch (e) {
              return dateStr
            }
          }

          const shiftDate = (days: number) => {
            try {
              const current = new Date(selectedDate)
              current.setDate(current.getDate() + days)
              const yStr = current.getFullYear()
              const mStr = String(current.getMonth() + 1).padStart(2, "0")
              const dStr = String(current.getDate()).padStart(2, "0")
              setSelectedDate(`${yStr}-${mStr}-${dStr}`)
            } catch (e) {
              console.error(e)
            }
          }

          return (
            <div className="flex items-center text-foreground font-bold text-[12px] font-sans relative">
              <div 
                onClick={() => {
                  if (dateInputRef.current) {
                    try {
                      dateInputRef.current.showPicker();
                    } catch (e) {
                      // Older browsers or restricted iframe environments fallback
                      // The absolute inset-0 z-10 native transparent input below handles native clicks directly.
                    }
                  }
                }}
                className="flex items-center gap-2 bg-card border border-border hover:border-[#00AAFF] hover:bg-card/70 transition-all rounded-lg px-3 py-1.5 cursor-pointer relative shadow-sm"
              >
                <Calendar size={13} className="text-primary" />
                <span className="tracking-wide text-[11.5px] text-foreground font-semibold select-none">
                  {formatDateDisplay(selectedDate)}
                </span>
                <ChevronDown size={11} className="text-muted-foreground" />
                <input 
                  ref={dateInputRef}
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    if (e.target.value) {
                      setSelectedDate(e.target.value)
                    }
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                />
              </div>
            </div>
          )
        })()}

        {/* Tab Switcher */}
        <div className="flex items-center bg-background border border-border rounded-full p-0.5">
          {(["DAY", "WEEK", "MONTH"] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`px-4 py-0.5 text-[10px] font-extrabold rounded-full transition-all tracking-wider font-sans ${view === v ? "bg-primary text-primary-foreground shadow-sm font-black" : "text-muted-foreground hover:text-foreground"}`}>{v}</button>
          ))}
        </div>
      </div>

      {/* ── Beautiful Table exactly as represented in Image ── */}
      <div className="overflow-x-auto rounded-xl border border-border bg-background/20 mx-4 mb-1">
        <table className="w-full text-[11.5px] border-collapse">
          <thead>
            <tr className="bg-card/80 border-b border-border">
              <th className="px-4 py-2.5 text-left font-bold text-muted-foreground text-[10px] tracking-wider uppercase whitespace-nowrap font-sans">S.No.</th>
              <th className="px-3 py-2.5 text-left font-bold text-muted-foreground text-[10px] tracking-wider uppercase whitespace-nowrap font-sans">Reg No</th>
              <th className="px-3 py-2.5 text-left font-bold text-muted-foreground text-[10px] tracking-wider uppercase whitespace-nowrap font-sans">
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                  Time Slot
                  <span className="inline-flex flex-col items-center justify-center bg-muted hover:bg-muted cursor-pointer rounded px-1 py-0.5 text-[7px] leading-[4px] text-white">
                    <span>▲</span>
                    <span>▼</span>
                  </span>
                </span>
              </th>
              <th className="px-3 py-2.5 text-left font-bold text-muted-foreground text-[10px] tracking-wider uppercase whitespace-nowrap font-sans">Service Type</th>
              <th className="px-3 py-2.5 text-left font-bold text-muted-foreground text-[10px] tracking-wider uppercase whitespace-nowrap font-sans">OMR(KMS)</th>
              <th className="px-3 py-2.5 text-left font-bold text-muted-foreground text-[10px] tracking-wider uppercase whitespace-nowrap font-sans">Model</th>
              <th className="px-3 py-2.5 text-left font-bold text-muted-foreground text-[10px] tracking-wider uppercase whitespace-nowrap font-sans">Status</th>
              <th className="px-3 py-2.5 text-left font-bold text-muted-foreground text-[10px] tracking-wider uppercase whitespace-nowrap font-sans">App Type</th>
              <th className="px-3 py-2.5 text-center font-bold text-muted-foreground text-[10px] tracking-wider uppercase whitespace-nowrap font-sans">Send SMS</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-muted-foreground font-sans">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Calendar size={24} className="text-muted-foreground opacity-60" />
                    <p className="text-[12px] font-semibold text-muted-foreground">No scheduled appointments for this date</p>
                    <button 
                      onClick={() => setSelectedDate("2026-04-16")} 
                      className="mt-1 text-[11px] text-primary hover:underline font-bold"
                    >
                      Reset to April 16, 2026
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((a, i) => (
                <tr key={a.regNo} onClick={() => setSelected(selected?.regNo === a.regNo ? null : a)}
                  className={`border-b border-border cursor-pointer transition-colors hover:bg-card/30 ${selected?.regNo === a.regNo ? "bg-primary/10 border-l-2 border-l-primary" : "bg-transparent"}`}>
                  <td className="px-4 py-3 text-muted-foreground font-bold text-[11.5px]">{i + 1}</td>
                  <td className="px-3 py-3 font-mono text-primary font-black text-[12.5px] hover:underline cursor-pointer">{a.regNoDisplay || a.regNo}</td>
                  <td className="px-3 py-3 text-foreground font-semibold text-[11.5px] font-mono">{a.timeSlot}</td>
                  <td className="px-3 py-3 text-foreground font-bold text-[11.5px] uppercase whitespace-nowrap">{a.serviceType}</td>
                  <td className="px-3 py-3 text-foreground font-mono font-bold text-[12px]">{a.omr.toLocaleString()}</td>
                  <td className="px-3 py-3 text-foreground font-bold text-[11.5px]">{a.model}</td>
                  <td className="px-3 py-3 text-muted-foreground font-semibold text-[11px]">{a.status}</td>
                  <td className="px-3 py-3 text-muted-foreground font-semibold text-[10.5px] max-w-[130px] leading-tight whitespace-pre-line">{a.appType || "—"}</td>
                  <td className="px-3 py-3 text-center">
                    <button onClick={(e) => { e.stopPropagation(); openSmsModal(a); }} className="inline-flex items-center justify-center p-1 rounded hover:bg-card/80 active:scale-95 transition-all text-primary hover:text-sky-300">
                      <svg className="w-6 h-5 stroke-[1.8]" viewBox="0 0 24 20" fill="none" stroke="currentColor">
                        <line x1="1" y1="6" x2="5" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        <line x1="0" y1="10" x2="4" y2="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        <line x1="1" y1="14" x2="5" y2="14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        <rect x="7" y="4" width="15" height="12" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
                        <path d="M7 6l7.5 5 7.5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <AnimatePresence>
        {selected && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden rounded-xl border border-primary/20 bg-card mx-4">
            <div className="p-4 flex items-start justify-between gap-4">
              <div className="flex-1 grid grid-cols-3 gap-3 text-[12px]">
                <div className="bg-card border border-border rounded-lg p-3 hover:border-primary/45 transition-colors duration-150">
                  <p className="text-primary text-[9px] uppercase font-bold tracking-wider mb-1">Registration No.</p>
                  <p className="text-primary font-mono font-bold text-[13px] tracking-wide uppercase">{selected.regNo}</p>
                </div>
                <div className="bg-card border border-border rounded-lg p-3 hover:border-primary/45 transition-colors duration-150">
                  <p className="text-primary text-[9px] uppercase font-bold tracking-wider mb-1">Model / Vehicle</p>
                  <p className="text-white font-bold text-[12.5px] uppercase">{selected.model}</p>
                </div>
                <div className="bg-card border border-border rounded-lg p-3 hover:border-primary/45 transition-colors duration-150">
                  <p className="text-primary text-[9px] uppercase font-bold tracking-wider mb-1">Time Slot / Schedule</p>
                  <p className="text-white font-mono font-bold text-[12.5px]">{selected.timeSlot}</p>
                </div>
                <div className="bg-card border border-border rounded-lg p-3 hover:border-primary/45 transition-colors duration-150">
                  <p className="text-primary text-[9px] uppercase font-bold tracking-wider mb-1">Service Type</p>
                  <p className="text-white font-bold text-[12.5px] uppercase">{selected.serviceType}</p>
                </div>
                <div className="bg-card border border-border rounded-lg p-3 hover:border-primary/45 transition-colors duration-150">
                  <p className="text-primary text-[9px] uppercase font-bold tracking-wider mb-1">Odometer Reading</p>
                  <p className="text-white font-mono font-bold text-[12.5px]">{selected.omr.toLocaleString()} KMS</p>
                </div>
                <div className="bg-card border border-border rounded-lg p-3 hover:border-primary/45 transition-colors duration-150">
                  <p className="text-primary text-[9px] uppercase font-bold tracking-wider mb-1">Application Type</p>
                  <p className="text-white font-bold text-[12.5px] uppercase">{selected.appType || "—"}</p>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <button onClick={() => onAction("jc-opening", { regNo: selected.regNo })}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-[12px] font-semibold rounded-lg hover:bg-primary/90 transition-all font-sans">
                  <FileText size={13} /> Open JC
                </button>
                <button onClick={() => onAction("vehicle-history", { regNo: selected.regNo })}
                  className="flex items-center gap-2 px-4 py-2 bg-card text-foreground text-[12px] font-semibold rounded-lg hover:bg-muted transition-all font-sans">
                  <Car size={13} /> History
                </button>
                <button onClick={() => openSmsModal(selected)} className="flex items-center gap-2 px-4 py-2 bg-card text-foreground text-[12px] font-semibold rounded-lg hover:bg-muted transition-all font-sans">
                  <Mail size={13} /> Send SMS
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <p className="text-[11px] text-muted-foreground font-mono">Showing {filtered.length} of {appointmentsList.length} appointments · 21-May-2026</p>

      {/* --- Highly Detailed Add Appointment / Update Appointment Flow Popup --- */}
      <AnimatePresence>
        {showAddPopup && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto"
          >
            <motion.div 
              initial={{ scale: 0.96, y: 10 }} 
              animate={{ scale: 1, y: 0 }} 
              exit={{ scale: 0.96, y: 10 }}
              className="relative w-full max-w-6xl bg-card rounded-lg border border-border overflow-hidden shadow-2xl flex flex-col max-h-[92vh] text-foreground"
            >
              {/* Top Banner Header - Dark Slate Styling */}
              <div className="bg-card border-b border-border text-white px-5 py-3.5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button 
                    type="button" 
                    onClick={() => setShowAddPopup(false)} 
                    className="p-1 hover:bg-card/70 rounded-full transition-colors text-white"
                  >
                    <ChevronLeft size={20} className="stroke-[2.5px]" />
                  </button>
                </div>
                
                <div className="text-[12px] font-semibold tracking-widest text-primary font-sans">
                  UPDATE APPOINTMENT
                </div>
              </div>

              {/* Sub-header bar of Details & Action Trigger Row */}
              <div className="bg-[#0E1B30] border-b border-border px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-8">
                  {/* Registration No. Box */}
                  <div className="flex flex-col">
                    <span className="text-[10px] text-primary font-bold uppercase tracking-wide">Registration No.</span>
                    <input 
                      type="text" 
                      value={formData.regNo} 
                      onChange={e => setFormData(p => ({ ...p, regNo: e.target.value.toUpperCase() }))}
                      className="text-[14px] font-bold text-primary uppercase bg-transparent border-none p-0 outline-none w-[110px] font-mono"
                    />
                  </div>

                  {/* Vertical separator */}
                  <div className="hidden md:block border-l border-border h-10"></div>

                  <div className="hidden md:flex flex-col items-start w-auto">
                    <span className="text-[10px] font-extrabold tracking-wide text-primary uppercase mb-1">
                      CUSTOMER & VEHICLE DETAILS
                    </span>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={formData.date1} 
                        onChange={e => setFormData(p => ({ ...p, date1: e.target.value }))}
                        className="text-[11px] bg-card border border-border text-foreground font-mono rounded px-2.5 py-1 outline-none w-[130px]"
                      />
                      <div className="relative flex items-center bg-card border border-border rounded px-2.5 py-1">
                        <input 
                          type="text" 
                          value={formData.date2} 
                          onChange={e => setFormData(p => ({ ...p, date2: e.target.value }))}
                          className="text-[11px] bg-transparent text-foreground font-mono outline-none w-[115px] mr-1"
                        />
                        <Calendar size={12} className="text-primary cursor-pointer" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  {/* Big Number and Details */}
                  <div className="flex items-center gap-6">
                    <span className="text-[32px] font-light text-primary leading-none">0</span>
                    <button type="button" className="text-[10px] text-primary hover:text-sky-300 font-bold uppercase tracking-wide transition-all">
                      VIEW DETAILS
                    </button>
                  </div>
                  
                  {/* Blue Pill Appointment Button */}
                  <button 
                    onClick={handleAddSubmit}
                    className="px-5 py-2 bg-[#00AAFF] hover:bg-[#009beb] text-white text-[10.5px] tracking-wider font-extrabold uppercase rounded-full shadow-lg transition-all duration-150"
                  >
                    UPDATE APPOINTMENT
                  </button>
                </div>
              </div>

              {/* Editable Body layout with specific NEXA-styled cards */}
              <div className="flex-1 overflow-y-auto p-4 md:p-5 grid grid-cols-1 md:grid-cols-12 gap-5">
                
                {/* COLUMN 1 (4/12 width) - Service Details */}
                <div className="md:col-span-4 bg-card rounded-lg border border-border p-5 flex flex-col">
                  <h3 className="text-[13px] font-extrabold uppercase tracking-wider text-primary text-center pb-3 font-sans border-b border-border mb-4">
                    Service Details
                  </h3>
                  
                  <div className="flex flex-col gap-4">
                    {/* LAST ATTENDED SM */}
                    <div className="border-b border-border pb-1.5">
                      <label className="block text-[9px] font-bold text-primary uppercase tracking-wider">
                        LAST ATTENDED SM
                      </label>
                      <div className="text-[12px] text-foreground font-bold py-1">
                        {formData.lastAttendedSm || "PARVEEN KUMAR"}
                      </div>
                    </div>

                    {/* CURRENT SM * with red star */}
                    <div className="border-b border-border pb-1.5 relative">
                      <label className="block text-[9px] font-bold text-primary uppercase tracking-wider">
                        CURRENT SM <span className="text-red-550 font-bold">*</span>
                      </label>
                      <select 
                        value={formData.currentSm}
                        onChange={e => setFormData(p => ({ ...p, currentSm: e.target.value }))}
                        className="w-full text-[12px] bg-transparent text-foreground font-bold py-1 outline-none appearance-none pr-6 cursor-pointer"
                      >
                        <option value="VISHAL YADAV" className="bg-card text-white">VISHAL YADAV</option>
                        <option value="PARVEEN KUMAR" className="bg-card text-white">PARVEEN KUMAR</option>
                        <option value="AMAN VASHIST" className="bg-card text-white">AMAN VASHIST</option>
                      </select>
                      <ChevronDown size={12} className="absolute right-1 bottom-2.5 text-muted-foreground pointer-events-none" />
                    </div>

                    {/* SLOT * with red star */}
                    <div className="border-b border-border pb-1.5 relative">
                      <label className="block text-[9px] font-bold text-primary uppercase tracking-wider">
                        SLOT <span className="text-red-550 font-bold">*</span>
                      </label>
                      <select 
                        value={formData.slot}
                        onChange={e => setFormData(p => ({ ...p, slot: e.target.value }))}
                        className="w-full text-[12px] bg-transparent text-foreground font-bold py-1 outline-none appearance-none pr-6 cursor-pointer"
                      >
                        <option value="-Select-" className="bg-card text-white">-Select-</option>
                        <option value="08:15–08:30" className="bg-card text-white">08:15–08:30</option>
                        <option value="09:15–09:30" className="bg-card text-white">09:15–09:30</option>
                        <option value="10:30–10:45" className="bg-card text-white">10:30–10:45</option>
                        <option value="11:45–12:00" className="bg-card text-white">11:45–12:00</option>
                      </select>
                      <ChevronDown size={12} className="absolute right-1 bottom-2.5 text-muted-foreground pointer-events-none" />
                    </div>

                    {/* TIME * with red star */}
                    <div className="border-b border-border pb-1.5 relative">
                      <label className="block text-[9px] font-bold text-primary uppercase tracking-wider">
                        TIME <span className="text-red-550 font-bold">*</span>
                      </label>
                      <select 
                        value={formData.timeSlot}
                        onChange={e => setFormData(p => ({ ...p, timeSlot: e.target.value }))}
                        className="w-full text-[12px] bg-transparent text-foreground font-bold py-1 outline-none appearance-none pr-6 cursor-pointer"
                      >
                        <option value="-Select-" className="bg-card text-white">-Select-</option>
                        <option value="08:15" className="bg-card text-white">08:15</option>
                        <option value="09:15" className="bg-card text-white">09:15</option>
                        <option value="10:30" className="bg-card text-white">10:30</option>
                        <option value="11:45" className="bg-card text-white">11:45</option>
                      </select>
                      <ChevronDown size={12} className="absolute right-1 bottom-2.5 text-muted-foreground pointer-events-none" />
                    </div>

                    {/* REMARKS(IF NOT SELECTED PREVIOUS SA) * */}
                    <div className="border-b border-border pb-1.5">
                      <label className="block text-[9px] font-bold text-primary uppercase tracking-wider">
                        REMARKS(IF NOT SELECTED PREVIOUS SA) <span className="text-red-500">*</span>
                      </label>
                      <input 
                        type="text" 
                        value={formData.remarks}
                        onChange={e => setFormData(p => ({ ...p, remarks: e.target.value }))}
                        className="w-full text-[12px] bg-transparent text-foreground font-bold py-1 outline-none" 
                      />
                    </div>

                    {/* OMR(KMS) * with red star */}
                    <div className="border-b border-border pb-1.5">
                      <label className="block text-[9px] font-bold text-primary uppercase tracking-wider">
                        OMR(KMS) <span className="text-red-500">*</span>
                      </label>
                      <input 
                        type="text" 
                        value={formData.omr}
                        onChange={e => setFormData(p => ({ ...p, omr: e.target.value }))}
                        className="w-full text-[12px] bg-transparent text-primary font-mono font-bold py-1 outline-none" 
                      />
                    </div>

                    {/* SERVICE TYPE * */}
                    <div className="border-b border-border pb-1.5 relative">
                      <label className="block text-[9px] font-bold text-primary uppercase tracking-wider">
                        SERVICE TYPE <span className="text-primary font-bold">*</span>
                      </label>
                      <select 
                        value={formData.serviceType}
                        onChange={e => setFormData(p => ({ ...p, serviceType: e.target.value }))}
                        className="w-full text-[12px] bg-transparent text-foreground font-bold py-1 outline-none appearance-none pr-6 cursor-pointer"
                      >
                        <option value="PAID SERVICE" className="bg-card text-white">PAID SERVICE</option>
                        <option value="2ND FREE SERVICE" className="bg-card text-white">2ND FREE SERVICE</option>
                        <option value="3RD FREE SERVICE" className="bg-card text-white">3RD FREE SERVICE</option>
                        <option value="RUNNING REPAIR" className="bg-card text-white">RUNNING REPAIR</option>
                      </select>
                      <ChevronDown size={12} className="absolute right-1 bottom-2.5 text-muted-foreground pointer-events-none" />
                    </div>
                  </div>
                </div>

                {/* COLUMN 2 (4/12 width) - Available SM & Vehicle Details */}
                <div className="md:col-span-4 flex flex-col gap-5">
                  {/* Available SM */}
                  <div className="bg-card rounded-lg border border-border p-5 flex flex-col">
                    <h3 className="text-[13px] font-extrabold uppercase tracking-wider text-primary text-center pb-3 font-sans border-b border-border mb-3">
                      Available SM
                    </h3>
                    <div className="flex flex-col gap-3 text-[11px] py-1 font-mono font-medium">
                      <div className="flex justify-between items-center text-primary hover:underline cursor-pointer">
                        <span>AMAN VASHIST</span>
                        <span className="text-muted-foreground font-extrabold">N/A</span>
                      </div>
                      <div className="flex justify-between items-center text-primary hover:underline cursor-pointer">
                        <span>ATUL</span>
                        <span className="text-muted-foreground font-extrabold">N/A</span>
                      </div>
                      <div className="flex justify-between items-center text-primary hover:underline cursor-pointer">
                        <span>GAJENDER SINGH</span>
                        <span className="text-muted-foreground font-extrabold">N/A</span>
                      </div>
                    </div>
                    
                    <button type="button" className="text-primary font-black uppercase tracking-wider text-[9px] text-right mt-2 hover:text-primary transition-colors font-sans">
                      VIEW ALL
                    </button>
                  </div>

                  {/* Vehicle Details */}
                  <div className="bg-card rounded-lg border border-border p-5 flex flex-col gap-4">
                    <h3 className="text-[13px] font-extrabold uppercase tracking-wider text-primary text-center pb-3 font-sans border-b border-border mb-1">
                      Vehicle Details
                    </h3>
                    
                    <div>
                      <span className="block text-[8.5px] font-bold text-primary uppercase tracking-wider mb-0.5">MODEL</span>
                      <input 
                        type="text" 
                        value={formData.model}
                        onChange={e => setFormData(p => ({ ...p, model: e.target.value }))}
                        className="w-full text-[12px] bg-transparent text-foreground font-bold outline-none border-b border-dashed border-border pb-1" 
                      />
                    </div>

                    <div>
                      <span className="block text-[8.5px] font-bold text-primary uppercase tracking-wider mb-0.5">VARIANT</span>
                      <input 
                        type="text" 
                        value={formData.variant}
                        onChange={e => setFormData(p => ({ ...p, variant: e.target.value }))}
                        className="w-full text-[12px] bg-transparent text-foreground font-bold outline-none border-b border-dashed border-border pb-1" 
                      />
                    </div>

                    <div>
                      <span className="block text-[8.5px] font-bold text-primary uppercase tracking-wider mb-0.5">VIN</span>
                      <input 
                        type="text" 
                        value={formData.vin}
                        onChange={e => setFormData(p => ({ ...p, vin: e.target.value.toUpperCase() }))}
                        className="w-full text-[12px] bg-transparent text-foreground font-mono font-bold outline-none border-b border-dashed border-border pb-1" 
                      />
                    </div>

                    <div>
                      <span className="block text-[8.5px] font-bold text-primary uppercase tracking-wider mb-0.5">CUSTOMER CATEGORY</span>
                      <div className="text-[12.5px] text-primary font-bold uppercase font-mono">
                        {formData.customerCategory}
                      </div>
                    </div>
                  </div>
                </div>

                {/* COLUMN 3 (4/12 width) - Customer Details */}
                <div className="md:col-span-4 bg-card rounded-lg border border-border p-5 flex flex-col gap-4">
                  <h3 className="text-[13px] font-extrabold uppercase tracking-wider text-primary text-center pb-3 font-sans border-b border-border mb-1">
                    Customer Details
                  </h3>
                  
                  <div>
                    <label className="block text-[8.5px] font-bold text-primary uppercase tracking-wider mb-0.5">
                      CUSTOMER NAME
                    </label>
                    <input 
                      type="text" 
                      value={formData.customerName}
                      onChange={e => setFormData(p => ({ ...p, customerName: e.target.value }))}
                      className="w-full text-[12.5px] bg-transparent text-foreground font-bold outline-none border-b border-dashed border-border pb-1" 
                    />
                  </div>

                  <div>
                    <label className="block text-[8.5px] font-bold text-primary uppercase tracking-wider mb-0.5">
                      MOBILE NO.1
                    </label>
                    <div className="relative flex items-center justify-between border-b border-dashed border-border pb-1">
                      <input 
                        type="text" 
                        value={formData.mobile1}
                        onChange={e => setFormData(p => ({ ...p, mobile1: e.target.value }))}
                        className="w-full text-[12.5px] bg-transparent text-foreground font-mono font-bold outline-none pr-16" 
                      />
                      <div className="absolute right-0 flex items-center gap-1 text-green-400 rounded text-[9px] font-extrabold tracking-wide uppercase">
                        <Check size={10} className="stroke-[3.5px]" /> Verified
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[8.5px] font-bold text-primary uppercase tracking-wider mb-0.5">
                      MOBILE NO.2
                    </label>
                    <input 
                      type="text" 
                      value={formData.mobile2}
                      onChange={e => setFormData(p => ({ ...p, mobile2: e.target.value }))}
                      className="w-full text-[12.5px] bg-transparent text-foreground font-bold outline-none border-b border-dashed border-border pb-1" 
                    />
                  </div>

                  <div>
                    <label className="block text-[8.5px] font-bold text-primary uppercase tracking-wider mb-0.5">
                      EMAIL
                    </label>
                    <input 
                      type="text" 
                      value={formData.email}
                      onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
                      className="w-full text-[12px] bg-transparent text-foreground font-bold outline-none border-b border-dashed border-border pb-1" 
                    />
                  </div>

                  <div>
                    <label className="block text-[8.5px] font-bold text-primary uppercase tracking-wider mb-0.5">
                      ADDRESS
                    </label>
                    <input 
                      type="text" 
                      value={formData.address}
                      onChange={e => setFormData(p => ({ ...p, address: e.target.value }))}
                      className="w-full text-[12px] bg-transparent text-foreground font-bold outline-none border-b border-dashed border-border pb-1" 
                    />
                  </div>

                  <div>
                    <label className="block text-[8.5px] font-bold text-primary uppercase tracking-wider mb-0.5">
                      STATE
                    </label>
                    <input 
                      type="text" 
                      value={formData.state}
                      onChange={e => setFormData(p => ({ ...p, state: e.target.value }))}
                      className="w-full text-[12.5px] bg-transparent text-foreground font-bold outline-none border-b border-dashed border-border pb-1" 
                    />
                  </div>

                  <div>
                    <label className="block text-[8.5px] font-bold text-primary uppercase tracking-wider mb-0.5">
                      CITY
                    </label>
                    <input 
                      type="text" 
                      value={formData.city}
                      onChange={e => setFormData(p => ({ ...p, city: e.target.value }))}
                      className="w-full text-[12.5px] bg-transparent text-foreground font-bold outline-none border-b border-dashed border-border pb-1" 
                    />
                  </div>
                </div>

              </div>

              {/* Form Bottom Bar - Dark Theme Styling */}
              <div className="bg-[#0E1B30] px-6 py-3.5 flex justify-end gap-3 border-t border-border">
                <button 
                  type="button" 
                  onClick={() => setShowAddPopup(false)}
                  className="px-5 py-2 text-muted-foreground bg-card hover:bg-muted transition-colors rounded font-extrabold uppercase text-[11px] font-sans tracking-wide"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleAddSubmit}
                  className="px-6 py-2 bg-[#00AAFF] hover:bg-[#009beb] text-white rounded font-extrabold uppercase text-[11px] font-sans tracking-wide transition-all"
                >
                  Create Appointment
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── NEXA High-Precision SMS Dispatcher Overlay ── */}
      <AnimatePresence>
        {smsApp && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 15 }} 
              animate={{ scale: 1, y: 0 }} 
              exit={{ scale: 0.95, y: 15 }}
              className="relative w-full max-w-xl bg-card rounded-2xl border border-border overflow-hidden shadow-2xl flex flex-col text-foreground font-sans text-left"
            >
              {/* Top Banner */}
              <div className="bg-card border-b border-border text-white px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#00AAFF] animate-pulse" />
                  <span className="text-[13px] font-extrabold uppercase tracking-widest font-serif text-white">N E X A &nbsp; S M S &nbsp; C E N T E R</span>
                </div>
                <button 
                  onClick={() => setSmsApp(null)} 
                  className="text-muted-foreground hover:text-white transition-colors text-[20px] leading-none"
                >
                  &times;
                </button>
              </div>

              {/* Success Screen state */}
              {smsSuccess ? (
                <div className="p-8 flex flex-col items-center justify-center text-center py-16">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 mb-4 animate-bounce">
                    <Check size={32} className="stroke-[3]" />
                  </div>
                  <h3 className="text-[18px] font-bold text-white uppercase tracking-wider mb-2">Message Dispatched</h3>
                  <p className="text-muted-foreground text-[12.5px] max-w-xs leading-relaxed">
                    The SMS has been successfully transmitted via Nexa SMS gateway to <span className="text-primary font-semibold">{smsPhone}</span>.
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-4 font-mono">Payload Reference: SMS_OK_200</p>
                </div>
              ) : (
                <div className="p-5 flex flex-col gap-4">
                  
                  {/* Recipient summary cards */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-card/60 border border-border rounded-xl p-3">
                      <p className="text-primary text-[9.5px] uppercase font-bold tracking-wider mb-1">RECIPIENT CLIENT</p>
                      <p className="text-white font-bold text-[13px] tracking-wide uppercase">{smsClientName}</p>
                    </div>
                    <div className="bg-card/60 border border-border rounded-xl p-3">
                      <p className="text-primary text-[9.5px] uppercase font-bold tracking-wider mb-1">TARGET MOBILE</p>
                      <input 
                        type="text" 
                        value={smsPhone} 
                        onChange={(e) => setSmsPhone(e.target.value)}
                        className="bg-transparent text-primary font-mono font-bold text-[13px] outline-none border-b border-dashed border-primary/30 w-full"
                      />
                    </div>
                  </div>

                  {/* Template Selectors */}
                  <div>
                    <label className="block text-[9.5px] font-bold text-primary uppercase tracking-wider mb-2">SELECT COMM TEMPLATE</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: "reminder", label: "Reminder", desc: "Appointment Schedule Slot" },
                        { id: "ready", label: "Ready", desc: "Vehicle Serviced & Ready" },
                        { id: "parts", label: "Parts Enquiry", desc: "Service Parts updates" }
                      ].map((t) => (
                        <button
                          key={t.id}
                          onClick={() => handleTemplateChange(smsApp, t.id)}
                          className={`p-2.5 rounded-xl text-left border transition-all flex flex-col justify-between h-[65px] ${
                            selectedTemplate === t.id 
                              ? "bg-primary/20 border-primary text-white" 
                              : "bg-card/30 border-border text-muted-foreground hover:bg-card/40"
                          }`}
                        >
                          <span className={`text-[12px] font-bold ${selectedTemplate === t.id ? "text-primary" : "text-white"}`}>
                            {t.label}
                          </span>
                          <span className="text-[9px] leading-tight text-muted-foreground font-sans">{t.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Custom draft preview box */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[9.5px] font-bold text-primary uppercase tracking-wider">SMS TRANSMISSION PAYLOAD</label>
                      <span className="text-[9.5px] font-mono text-muted-foreground">{smsText.length} Characters</span>
                    </div>
                    <textarea
                      rows={4}
                      value={smsText}
                      onChange={(e) => setSmsText(e.target.value)}
                      className="w-full bg-card border border-border rounded-xl p-3.5 text-[12px] text-[#E2E8F0] leading-relaxed outline-none focus:border-primary/65 resize-none font-sans"
                    />
                  </div>

                  {/* Buttons footer */}
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setSmsApp(null)}
                      className="px-4 py-2 text-muted-foreground bg-card hover:bg-muted transition-all rounded-lg font-extrabold uppercase text-[10.5px] tracking-wider"
                    >
                      Dismiss
                    </button>
                    <button
                      onClick={sendSmsTrigger}
                      disabled={smsLoading || !smsText}
                      className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-[#00AAFF] to-primary hover:opacity-95 text-white active:scale-[0.98] transition-all rounded-lg font-extrabold uppercase text-[10.5px] tracking-wider disabled:opacity-50"
                    >
                      {smsLoading ? (
                        <>
                          <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Broadcasting...
                        </>
                      ) : (
                        <>
                          <Mail size={13} />
                          Transmit SMS
                        </>
                      )}
                    </button>
                  </div>

                </div>
              )}

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Vehicle History Panel ─────────────────────────────────────────────────────
function VehicleScanner({ onScan, onClose }: { onScan: (images: string[]) => void, onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  
  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
      .then(s => {
        if (videoRef.current) {
          videoRef.current.srcObject = s;
        }
      })
      .catch(() => {});
  }, []);

  const takePhoto = () => {
    const newImage = "data:image/jpeg;base64,PLACEHOLDER";
    setCapturedImages(prev => [...prev, newImage]);
  };

  return (
    <div className="p-4 rounded-xl border border-border bg-background flex flex-col gap-3 relative max-w-xl w-full mx-auto shadow-2xl">
      <div className="flex justify-between items-center">
        <h2 className="text-sm font-black uppercase text-foreground">Vehicle Surface Scan</h2>
        <button onClick={onClose}><X /></button>
      </div>
      <div className="aspect-video bg-black rounded-lg relative">
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
      </div>
      <div className="flex flex-wrap gap-2">
        {capturedImages.map((img, i) => <div key={i} className="w-16 h-16 bg-muted rounded border border-border" />)}
        <button onClick={takePhoto} className="w-16 h-16 bg-primary text-white flex items-center justify-center rounded">+</button>
      </div>
      <button onClick={() => onScan(capturedImages)} className="w-full py-2 bg-primary text-white rounded">Analyze Images</button>
    </div>
  );
}

function PlateScanner({ onScan, onClose }: { onScan: (res: string) => void, onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState("");
  const [isSimulated, setIsSimulated] = useState(false);
  const [scanningStatus, setScanningStatus] = useState("Initializing camera sensor...");
  const [selectedSimPlate, setSelectedSimPlate] = useState("DL6CR1517");
  const [simProgress, setSimProgress] = useState(0);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let fallbackTimeout: number;

    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
      .then(s => {
        stream = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.setAttribute("playsinline", "true");
          videoRef.current.play().catch(() => {});
        }
        setScanningStatus("Align vehicle plate in focus frame...");
        
        fallbackTimeout = window.setTimeout(() => {
          onScan(selectedSimPlate);
        }, 3200);
      })
      .catch(err => {
        setIsSimulated(true);
        setScanningStatus("Iframe sandbox constraint. Activating Optical HUD simulation...");
      });

    return () => {
      if (fallbackTimeout) clearTimeout(fallbackTimeout);
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
    };
  }, [selectedSimPlate, onScan]);

  // Handle simulation countdown and progress bar
  useEffect(() => {
    if (!isSimulated) return;

    setSimProgress(0);
    const interval = setInterval(() => {
      setSimProgress(p => {
        if (p >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            onScan(selectedSimPlate);
          }, 300);
          return 100;
        }
        return p + 4;
      });
    }, 120);

    return () => clearInterval(interval);
  }, [isSimulated, selectedSimPlate, onScan]);

  // Stage text logs based on progress
  useEffect(() => {
    if (!isSimulated) return;
    if (simProgress < 25) {
      setScanningStatus("CONNECTING COGNITIVE WEBCAM MATRIX...");
    } else if (simProgress < 55) {
      setScanningStatus("LOCALIZING PLATE CONTOURS...");
    } else if (simProgress < 85) {
      setScanningStatus("RUNNING CHARACTER RECOGNITION (OCR)...");
    } else {
      setScanningStatus(`SUCCESS — RECOGNIZED PLATE: ${selectedSimPlate}`);
    }
  }, [simProgress, selectedSimPlate, isSimulated]);

  return (
    <div className="p-4 rounded-xl border border-border bg-background flex flex-col gap-3 relative max-w-full w-full mx-auto shadow-2xl">
      <div className="flex items-center justify-between border-b border-border pb-2.5">
        <span className="text-[12px] font-bold text-foreground font-sans uppercase tracking-wider flex items-center gap-1.5 animate-pulse">
          <Camera size={13} className="text-primary" /> 
          {isSimulated ? "Optical HUD OCR Simulator" : "License Plate OCR Scanner"}
        </span>
        <button onClick={onClose} className="p-1 text-muted-foreground hover:text-white rounded hover:bg-card cursor-pointer transition-colors" title="Close"><X size={14} /></button>
      </div>

      <div className="relative rounded-lg overflow-hidden border border-border bg-background aspect-video flex flex-col items-center justify-center min-h-[170px]">
        {/* Unifying standard overlays across BOTH simulated & raw feed */}
        
        {/* 1. Global Scan Ambient Tech grid overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(18,30,55,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(18,30,55,0.05)_1px,transparent_1px)] bg-[size:14px_14px] opacity-75 pointer-events-none z-10" />

        {/* 2. Scanning View Feed (The Base Layer) */}
        {isSimulated ? (
          <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center p-4 overflow-hidden bg-gradient-to-br from-[#060B16] to-[#03060C]">
            {/* Simulated plate target card */}
            <div className="relative z-10 flex flex-col items-center justify-center p-3">
              {/* High-Contrast Plate UI mimicking standard license plates */}
              <div className="px-5 py-2.5 bg-yellow-400 text-black border-2 border-yellow-500 rounded font-bold font-mono tracking-widest text-center shadow-[0_4px_12px_rgba(250,204,21,0.25)] flex flex-col items-center select-none leading-none scale-105">
                <span className="text-[8px] tracking-wide text-black/60 uppercase font-black">IND</span>
                <span className="text-base text-black mt-0.5">{selectedSimPlate}</span>
              </div>
            </div>
            
            {/* Bottom notification banner */}
            <div className="absolute bottom-2 bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 px-3 py-1 text-[9px] rounded-md font-sans font-semibold backdrop-blur-sm z-20">
              ℹ️ Sandbox Iframe Constraints Active — Running HUD Emulator Flow
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 w-full h-full">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover opacity-80" />
          </div>
        )}

        {/* 3. High-Contrast Overlay Frame Alignment Guide & Laser Sweeper (Shared overlay) */}
        <div className="absolute inset-0 flex flex-col items-center justify-center z-12 pointer-events-none select-none">
          {/* Top telemetry lines */}
          <div className="absolute top-2.5 left-3 right-3 flex justify-between text-[8px] font-mono text-primary/60 tracking-wider">
            <span>SYS_CAM: ACTIVE_FEED_1080P</span>
            <span className="animate-pulse">STATUS: {isSimulated ? "SIMULATED_DEVICES" : "LIVE_SENSOR_STABLE"}</span>
          </div>

          {/* Letterbox dark overlays to frame the license plate spotlight */}
          <div className="absolute top-0 inset-x-0 h-[22%] bg-black/65 border-b border-primary/10 flex items-center justify-center">
            <span className="text-[9px] text-primary/50 tracking-widest font-mono select-none uppercase font-bold">ALIGN LICENSE PLATE CENTER</span>
          </div>
          <div className="absolute bottom-0 inset-x-0 h-[22%] bg-black/65 border-t border-primary/10" />
          <div className="absolute top-[22%] bottom-[22%] left-0 w-[10%] bg-black/65" />
          <div className="absolute top-[22%] bottom-[22%] right-0 w-[10%] bg-black/65" />

          {/* Inner focal alignment zone (The bounding box visual guide) */}
          <div className="relative w-[80%] h-[56%] border border-primary/30 rounded-lg flex flex-col justify-between p-2 shadow-[0_0_20px_rgba(61,142,240,0.15)] bg-primary/2">
            
            {/* Corner Bracket Elements matching focus target alignment */}
            <div className="absolute -top-[1.5px] -left-[1.5px] w-4 h-4 border-t-2 border-l-2 border-[#4ADE80] rounded-tl shadow-[0_0_8px_rgba(74,222,128,0.5)] transition-all duration-300 animate-pulse" />
            <div className="absolute -top-[1.5px] -right-[1.5px] w-4 h-4 border-t-2 border-r-2 border-[#4ADE80] rounded-tr shadow-[0_0_8px_rgba(74,222,128,0.5)] transition-all duration-300 animate-pulse" />
            <div className="absolute -bottom-[1.5px] -left-[1.5px] w-4 h-4 border-b-2 border-l-2 border-[#4ADE80] rounded-bl shadow-[0_0_8px_rgba(74,222,128,0.5)] transition-all duration-300 animate-pulse" />
            <div className="absolute -bottom-[1.5px] -right-[1.5px] w-4 h-4 border-b-2 border-r-2 border-[#4ADE80] rounded-br shadow-[0_0_8px_rgba(74,222,128,0.5)] transition-all duration-300 animate-pulse" />

            {/* Central crosshair alignment aid */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center opacity-30">
              <div className="w-5 h-0.5 bg-primary rounded-full absolute" />
              <div className="h-5 w-0.5 bg-primary rounded-full absolute" />
            </div>

            {/* Guide markers or text indicators side labels inside alignment scope */}
            <div className="absolute left-2 top-1/2 -translate-y-1/2 text-[7px] font-mono text-primary/50 flex flex-col gap-0.5">
              <span>L_ALIGN</span>
              <span>- - - - -</span>
            </div>
            <div className="absolute right-2 top-1/2 -translate-y-1/2 text-[7px] font-mono text-primary/50 text-right flex flex-col gap-0.5">
              <span>R_ALIGN</span>
              <span>- - - - -</span>
            </div>

            {/* Progress Bar inside HUD (Displays character recognition percentage dynamically) */}
            <div className="mt-auto w-full z-10 flex flex-col gap-0.5 max-w-[200px] mx-auto bg-black/75 px-2.5 py-1 rounded border border-primary/20 backdrop-blur-sm">
              <div className="flex justify-between text-[7.5px] font-mono text-primary font-bold">
                <span>OCR ANALYSIS</span>
                <span>{isSimulated ? `${simProgress}%` : "READY"}</span>
              </div>
              <div className="w-full h-1 bg-card rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[#4ADE80] shadow-[0_0_6px_#4ADE80]" 
                  style={{ 
                    width: isSimulated ? `${simProgress}%` : '100%', 
                    transition: isSimulated ? 'width 0.1s linear' : 'none' 
                  }} 
                />
              </div>
            </div>
          </div>

          {/* Glowing Animated Lateral Sweeper (The laser sweep scanning line!) */}
          <div 
            className="absolute inset-x-0 h-0.5 bg-primary shadow-[0_0_12px_rgba(61,142,240,1)] z-20 pointer-events-none"
            style={{ 
              top: isSimulated 
                ? `${Math.sin((simProgress / 100) * Math.PI) * 45 + 50}%` 
                : 'auto',
              animation: isSimulated ? undefined : 'laserPulse 2s ease-in-out infinite alternate'
            }} 
          />
        </div>
      </div>

      {/* Embedded CSS custom laser Pulse animations for global usage */}
      <style>{`
        @keyframes laserPulse {
          0% { top: 22%; opacity: 0.3; }
          50% { opacity: 0.95; }
          100% { top: 78%; opacity: 0.3; }
        }
      `}</style>

      <div className="bg-card/50 p-2.5 rounded-lg border border-border text-center">
        <p className="text-[11px] text-muted-foreground font-semibold font-sans flex items-center justify-center gap-1.5 shrink-0">
          <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
          {scanningStatus}
        </p>
      </div>

      <div className="flex flex-col gap-1.5 mt-1 border-t border-border pt-2.5">
        <p className="text-[10px] text-muted-foreground/80 uppercase font-bold font-sans tracking-widest text-left">Click a vehicle below to target & scan instantly:</p>
        <div className="flex gap-2">
          {["DL6CR1517", "HR26DS6144"].map(plate => (
            <button 
              key={plate} 
              onClick={() => {
                setSelectedSimPlate(plate);
                if (isSimulated) setSimProgress(0); // restart progress bar with new target
              }} 
              className={`px-3 py-1.5 border font-mono text-[11.5px] rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${selectedSimPlate === plate ? 'bg-primary/20 border-primary text-primary font-bold' : 'bg-card border-border text-foreground hover:border-primary/50'}`}
            >
              🚗 {plate}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function VehicleHistoryPanel({ initialReg }: { initialReg?: string }) {
  const [regNo, setRegNo] = useState(initialReg || "")
  const [searched, setSearched] = useState(!!initialReg)
  const [yearFilter, setYearFilter] = useState<"2" | "5" | "5+">("2")
  const [showConfirm, setShowConfirm] = useState<"5" | "5+" | null>(null)
  const [selectedRecord, setSelectedRecord] = useState<VehicleRecord | null>(null)
  
  // Camera scanning state variable
  const [isScanningPlate, setIsScanningPlate] = useState(false)

  const vehicleData = VEHICLE_HISTORY[regNo.toUpperCase()]
  const allRecords = vehicleData?.records || []
  const now = new Date()
  const cutoffs = { "2": 2, "5": 5, "5+": 100 }
  const records = allRecords.filter(r => {
    const year = parseInt(r.date.slice(-4))
    const diff = now.getFullYear() - year
    if (yearFilter === "5+") return diff > 5
    return diff <= cutoffs[yearFilter]
  })

  function handleSearch() {
    if (regNo.trim().length < 4) return
    setSearched(true); setSelectedRecord(null)
  }

  // Handle immediate search after updating via effects if needed
  const triggerScanDone = (scannedPlate: string) => {
    setRegNo(scannedPlate);
    setSearched(true);
    setSelectedRecord(null);
    setIsScanningPlate(false);
  }

  return (
    <div className="flex flex-col gap-3">
      {isScanningPlate ? (
        <PlateScanner onScan={triggerScanDone} onClose={() => setIsScanningPlate(false)} />
      ) : (
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={regNo} onChange={e => setRegNo(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSearch()}
              placeholder="Enter Reg No or VIN…"
              className="w-full pl-8 pr-3 py-2.5 text-[13px] bg-card border border-border rounded-lg text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 font-mono uppercase" />
          </div>
          
          <button onClick={() => setIsScanningPlate(true)} id="plate-camera-trigger"
            className="px-4 py-2.5 bg-card border border-border text-primary hover:text-white hover:bg-muted text-[13px] font-bold rounded-lg transition-all font-sans flex items-center gap-1.5 cursor-pointer"
            title="Scan License Plate using Camera">
            <Camera size={14} /> SCAN
          </button>
          
          <button onClick={handleSearch}
            className="px-5 py-2.5 bg-primary text-primary-foreground text-[13px] font-bold rounded-lg hover:bg-primary/90 transition-all font-sans cursor-pointer">GO</button>
        </div>
      )}
      {searched && !vehicleData && (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-[#2A0D0D]/40 border border-[#F87171]/20 text-[#F87171] text-[13px]">
          <AlertTriangle size={15} /> Invalid registration number. Please check and try again.
        </div>
      )}
      {searched && vehicleData && (
        <>
          <div className="flex items-center justify-between p-3 rounded-xl bg-card/50 border border-border">
            <div className="flex gap-6 text-[12px]">
              <div><p className="text-muted-foreground text-[10px] uppercase font-sans tracking-wide">Reg No</p>
                <p className="text-primary font-mono font-medium">{regNo.toUpperCase()}</p></div>
              <div><p className="text-muted-foreground text-[10px] uppercase font-sans tracking-wide">Model</p>
                <p className="text-foreground">{vehicleData.model}</p></div>
              <div><p className="text-muted-foreground text-[10px] uppercase font-sans tracking-wide">VIN</p>
                <p className="text-foreground font-mono">{vehicleData.vin}</p></div>
              <div><p className="text-muted-foreground text-[10px] uppercase font-sans tracking-wide">Records</p>
                <p className="text-foreground font-mono">{allRecords.length} total</p></div>
            </div>
            <div className="relative">
              <select value={yearFilter} onChange={e => {
                const val = e.target.value as "2" | "5" | "5+"
                if (val !== "2") setShowConfirm(val); else setYearFilter("2")
              }}
                className="appearance-none px-3 py-1.5 pr-7 text-[12px] bg-card border border-border rounded-lg text-foreground outline-none font-sans font-semibold cursor-pointer">
                <option value="2">Last 2 Years</option>
                <option value="5">Last 5 Years</option>
                <option value="5+">More than 5 Years</option>
              </select>
              <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            </div>
          </div>
          <AnimatePresence>
            {showConfirm && (
              <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }}
                className="p-3 rounded-xl bg-[#1A1A0D]/60 border border-[#FACC15]/20 flex items-center justify-between text-[12px]">
                <p className="text-[#FACC15]">Fetching {showConfirm === "5+" ? "history older than 5 years" : "last 5 years"} may include third-party records. Confirm?</p>
                <div className="flex gap-2">
                  <button onClick={() => { setYearFilter(showConfirm); setShowConfirm(null) }}
                    className="px-3 py-1 bg-[#FACC15]/20 border border-[#FACC15]/30 text-[#FACC15] rounded-lg font-semibold font-sans">Confirm</button>
                  <button onClick={() => setShowConfirm(null)}
                    className="px-3 py-1 bg-card text-muted-foreground rounded-lg font-sans">Cancel</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {records.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-[13px]">No Vehicle History Available for selected period.</div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-[11.5px]">
                <thead>
                  <tr className="border-b border-border bg-card/60">
                    {["#", "Service Date", "Service Type", "Mileage", "Dealer / Description"].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left font-semibold text-muted-foreground font-sans text-[11px] tracking-wide uppercase whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {records.map((r, i) => (
                    <tr key={i} onClick={() => setSelectedRecord(selectedRecord?.jcNo === r.jcNo ? null : r)}
                      className={`border-b border-border cursor-pointer transition-colors hover:bg-card/40 ${selectedRecord?.jcNo === r.jcNo ? "bg-primary/8 border-l-2 border-l-primary" : ""}`}>
                      <td className="px-3 py-2.5 text-muted-foreground">{i + 1}</td>
                      <td className="px-3 py-2.5 text-primary font-mono font-medium">{r.date}</td>
                      <td className="px-3 py-2.5 text-foreground whitespace-nowrap">{r.serviceType}</td>
                      <td className="px-3 py-2.5 text-foreground font-mono">{r.mileage.toLocaleString()} km</td>
                      <td className="px-3 py-2.5 text-foreground">{r.dealer}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <AnimatePresence>
            {selectedRecord && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden rounded-xl border border-primary/20 bg-card p-4 mt-3">
                <p className="text-[11px] text-muted-foreground uppercase font-sans font-semibold tracking-wide mb-3">JC Details — {selectedRecord.jcNo}</p>
                <div className="grid grid-cols-3 gap-3 text-[12px] mb-3">
                  <div><p className="text-muted-foreground text-[10px] uppercase font-sans tracking-wide mb-0.5">JC Number</p>
                    <p className="text-primary font-mono">{selectedRecord.jcNo}</p></div>
                  <div><p className="text-muted-foreground text-[10px] uppercase font-sans tracking-wide mb-0.5">Service Type</p>
                    <p className="text-foreground">{selectedRecord.serviceType}</p></div>
                  <div><p className="text-muted-foreground text-[10px] uppercase font-sans tracking-wide mb-0.5">Mileage at Visit</p>
                    <p className="text-foreground font-mono">{selectedRecord.mileage.toLocaleString()} km</p></div>
                </div>
                <div className="text-[12px] mb-3">
                  <p className="text-muted-foreground text-[10px] uppercase font-sans tracking-wide mb-0.5">Dealer</p>
                  <p className="text-foreground">{selectedRecord.dealer}</p>
                </div>
                <div className="flex gap-2">
                  <button className="flex items-center gap-1.5 px-3 py-1.5 bg-card text-foreground text-[11px] font-semibold rounded-lg hover:bg-muted font-sans"><Eye size={12} /> View JC</button>
                  <button className="flex items-center gap-1.5 px-3 py-1.5 bg-card text-foreground text-[11px] font-semibold rounded-lg hover:bg-muted font-sans"><Download size={12} /> Download</button>
                  <button className="flex items-center gap-1.5 px-3 py-1.5 bg-card text-foreground text-[11px] font-semibold rounded-lg hover:bg-muted font-sans"><Printer size={12} /> Print</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
      {!searched && (
        <p className="text-[12px] text-muted-foreground">Try: <span className="text-primary font-mono cursor-pointer" onClick={() => { setRegNo("DL6CR1517"); setSearched(true) }}>DL6CR1517</span> or <span className="text-primary font-mono cursor-pointer" onClick={() => { setRegNo("HR26DS6144"); setSearched(true) }}>HR26DS6144</span></p>
      )}
    </div>
  )
}

// ── JC Opening Panel ─────────────────────────────────────────────────────────

function SignaturePad({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = "#4ADE80"; // NEXA Success Green Accent
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  const getPos = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      if (e.touches.length === 0) return { x: 0, y: 0 };
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      };
    } else {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if ('touches' in e) {
      if (e.cancelable) e.preventDefault();
    }

    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if ('touches' in e) {
      if (e.cancelable) e.preventDefault();
    }

    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      onChange(canvas.toDataURL());
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    onChange(null);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="relative h-24 rounded-lg border border-border bg-background overflow-hidden flex flex-col justify-between">
        <canvas
          ref={canvasRef}
          width={400}
          height={96}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="w-full h-full cursor-crosshair touch-none"
        />
        {value === null && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-muted-foreground/35 text-[11px] uppercase tracking-wider font-semibold font-sans">
            Draw customer signature here
          </div>
        )}
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={clear}
          className="px-2.5 py-1 text-[10px] uppercase tracking-wider bg-card text-muted-foreground hover:text-foreground font-bold font-sans rounded hover:bg-muted transition-all cursor-pointer"
        >
          Clear Pad
        </button>
      </div>
    </div>
  );
}

const STEP_LABELS = ["VIN / Reg", "Details", "Vehicle Status", "Tyre & Battery", "Demands", "Summary"]

function JCOpeningPanel({ initialReg }: { initialReg?: string }) {
  const [step, setStep] = useState(initialReg ? 1 : 0)
  const [regNo, setRegNo] = useState(initialReg || "")
  const [scanned, setScanned] = useState(!!initialReg)
  const [isScanning, setIsScanning] = useState(false)
  const [odometer, setOdometer] = useState("40002")
  const [serviceType, setServiceType] = useState("PAID SERVICE")
  const [fuel, setFuel] = useState(50)
  const [tyre, setTyre] = useState({ fl: "4", fr: "fr", rl: "3", rr: "4" })
  const [battery, setBattery] = useState("Good")
  const [demands, setDemands] = useState(JC_DEMANDS)
  const [showAddDemandRow, setShowAddDemandRow] = useState(false)
  const [newType, setNewType] = useState<"L" | "P">("L")
  const [newDesc, setNewDesc] = useState("")
  const [newCode, setNewCode] = useState("")
  const [newQty, setNewQty] = useState(1)
  const [newPrice, setNewPrice] = useState(0)
  const [submitted, setSubmitted] = useState(false)
  const [signatureData, setSignatureData] = useState<string | null>(null)

  const simulateScan = () => { setIsScanning(true) }
  const handleScanComplete = (res: string) => { setRegNo(res); setScanned(true); setIsScanning(false); }
  const fuelLevels = [0, 25, 50, 75, 100]
  const labourTotal = demands.filter(d => d.type === "L").reduce((s, d) => s + d.price * d.qty, 0)
  const partsTotal = demands.filter(d => d.type === "P").reduce((s, d) => s + d.price * d.qty, 0)

  if (submitted) {
    const handleActionClick = (act: 'download' | 'print') => {
      const mockCreatedJC = {
        jcNo: "JC26000512",
        dealer: "PREM MOTORS PVT. LTD., GURGAON-2S(NEXA)",
        dealerMapCode: "PMG2S001",
        visitDate: "21-MAY-2026",
        gateIn: "09:42",
        serviceType: serviceType,
        techName: "VISHAL ADITYA",
        bay: "BAY-04",
        paymentMode: "ONLINE / CASH",
        promisedDate: "21-MAY-2026",
        promisedTime: "06:00 PM",
        customer: {
          name: "RAJAT AGARWAL",
          mobile1: "+91 99110 03322",
          email: "rajat.agarwal@gmail.com",
          address: "DLF Phase 3, Cyber City",
          city: "Gurugram",
          regNo: regNo || "HR26CW7677",
          vin: "MA3YFDS75K008432",
          model: "MARUTI BALENO PETROL",
        },
        demands: demands.map((d, s) => ({ ...d, sno: s + 1 })),
        labour: demands.filter(d => d.type === 'L').map((d, s) => ({
          sno: s + 1,
          code: d.code,
          desc: d.desc,
          qty: d.qty,
          prnHrs: 1.0,
          billableType: "Billable",
          amount: d.price * d.qty
        })),
        parts: demands.filter(d => d.type === 'P').map((d, s) => ({
          sno: s + 1,
          code: d.code,
          desc: d.desc,
          qty: d.qty,
          price: d.price,
          amount: d.price * d.qty
        })),
        odometer: parseInt(odometer) || 40002
      };
      generateJcPdf(mockCreatedJC, act);
    };

    return (
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-4 py-8">
        <div className="w-16 h-16 rounded-full bg-[#4ADE80]/20 flex items-center justify-center">
          <CheckCircle size={32} className="text-[#4ADE80]" />
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-foreground font-sans">Job Card Generated!</p>
          <p className="text-[13px] text-muted-foreground">JC26000512 — {regNo}</p>
          <p className="text-[12px] text-muted-foreground mt-1">OCAS sent to customer for approval</p>
        </div>
        <div className="flex gap-2 mt-2">
          <button onClick={() => handleActionClick('print')} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-[12px] font-semibold rounded-lg font-sans cursor-pointer"><Eye size={13} /> View JC</button>
          <button onClick={() => handleActionClick('download')} className="flex items-center gap-2 px-4 py-2 bg-card text-foreground text-[12px] font-semibold rounded-lg font-sans cursor-pointer"><Download size={13} /> Download</button>
          <button onClick={() => handleActionClick('print')} className="flex items-center gap-2 px-4 py-2 bg-card text-foreground text-[12px] font-semibold rounded-lg font-sans cursor-pointer"><Printer size={13} /> Print</button>
        </div>
      </motion.div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Stepper */}
      <div className="flex items-center gap-0">
        {STEP_LABELS.map((label, i) => (
          <div key={i} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold font-sans transition-all ${i < step ? "bg-[#4ADE80] text-[#070C16]" : i === step ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground"}`}>
                {i < step ? <Check size={13} /> : i + 1}
              </div>
              <p className={`text-[10px] font-sans font-semibold whitespace-nowrap ${i === step ? "text-primary" : i < step ? "text-[#4ADE80]" : "text-muted-foreground"}`}>{label}</p>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div className={`flex-1 h-px mx-1 transition-all ${i < step ? "bg-[#4ADE80]/50" : "bg-border"}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step 0: Scan */}
      {step === 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-3">
          <p className="text-[12px] text-muted-foreground">Scan the VIN barcode or enter registration number manually.</p>
          
          {isScanning ? (
            <PlateScanner onScan={handleScanComplete} onClose={() => setIsScanning(false)} />
          ) : (
            <>
              <div className="flex gap-2">
                <input value={regNo} onChange={e => setRegNo(e.target.value.toUpperCase())} placeholder="Enter Reg No or VIN…"
                  className="flex-1 px-3 py-2.5 text-[13px] bg-card border border-border rounded-lg text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 font-mono uppercase" />
                <button onClick={simulateScan}
                  className="px-4 py-2.5 bg-card border border-border text-foreground text-[12px] font-semibold rounded-lg hover:bg-muted transition-all font-sans flex items-center gap-2">
                  <Camera size={13} /> Scan
                </button>
              </div>
              {scanned && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="flex items-center gap-2 p-3 rounded-lg bg-[#0D2E1A]/60 border border-[#4ADE80]/20 text-[#4ADE80] text-[12px]">
                  <CheckCircle size={14} /> Scanned: <span className="font-mono font-medium">{regNo}</span>
                </motion.div>
              )}
            </>
          )}
          
          <button disabled={!regNo} onClick={() => setStep(1)}
            className="self-end flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground text-[13px] font-bold rounded-lg hover:bg-primary/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed font-sans">
            Next <ArrowRight size={14} />
          </button>
        </motion.div>
      )}

      {/* Step 1: Customer & Vehicle Details */}
      {step === 1 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-[12px]">
            <div className="col-span-2 p-3 rounded-xl bg-card/40 border border-border flex gap-6">
              <div><p className="text-muted-foreground text-[10px] uppercase font-sans tracking-wide mb-0.5">Model</p><p className="text-foreground font-semibold">MARUTI BALENO PETROL</p></div>
              <div><p className="text-muted-foreground text-[10px] uppercase font-sans tracking-wide mb-0.5">Reg No</p><p className="text-primary font-mono">{regNo}</p></div>
              <div><p className="text-muted-foreground text-[10px] uppercase font-sans tracking-wide mb-0.5">VIN</p><p className="text-foreground font-mono">MA3FJEB1SND789012</p></div>
              <div><p className="text-muted-foreground text-[10px] uppercase font-sans tracking-wide mb-0.5">FC OK Date</p><p className="text-foreground">21-MAY-27</p></div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase font-sans font-semibold tracking-wide text-muted-foreground">Odometer Reading *</label>
              <input value={odometer} onChange={e => setOdometer(e.target.value)}
                className="px-3 py-2 bg-card border border-border rounded-lg text-foreground outline-none focus:border-primary/50 font-mono" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase font-sans font-semibold tracking-wide text-muted-foreground">Service Type *</label>
              <div className="relative">
                <select value={serviceType} onChange={e => setServiceType(e.target.value)}
                  className="w-full appearance-none px-3 py-2 bg-card border border-border rounded-lg text-foreground outline-none font-sans">
                  {["PAID SERVICE", "1ST FREE SERVICE", "2ND FREE SERVICE", "3RD FREE SERVICE", "RUNNING REPAIR", "PMS"].map(s => <option key={s}>{s}</option>)}
                </select>
                <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase font-sans font-semibold tracking-wide text-muted-foreground">Customer Name</label>
              <input defaultValue="PREM MOTORS TRUE VALUE" className="px-3 py-2 bg-card/50 border border-border rounded-lg text-muted-foreground outline-none font-sans cursor-not-allowed" readOnly />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase font-sans font-semibold tracking-wide text-muted-foreground">Mobile No. *</label>
              <input defaultValue="8708 467 728" className="px-3 py-2 bg-card border border-border rounded-lg text-foreground outline-none focus:border-primary/50 font-mono" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase font-sans font-semibold tracking-wide text-muted-foreground">Email *</label>
              <input defaultValue="ab@123gmail.com" className="px-3 py-2 bg-card border border-border rounded-lg text-foreground outline-none focus:border-primary/50 font-mono" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase font-sans font-semibold tracking-wide text-muted-foreground">Gate In Date / Time</label>
              <input defaultValue="21-May-2026 10:30" className="px-3 py-2 bg-card border border-border rounded-lg text-foreground outline-none focus:border-primary/50 font-mono" />
            </div>
          </div>
          <div className="flex justify-between mt-2">
            <button onClick={() => setStep(0)} className="flex items-center gap-2 px-4 py-2 bg-card text-foreground text-[12px] font-semibold rounded-lg hover:bg-muted font-sans"><ChevronLeft size={13} /> Back</button>
            <button onClick={() => setStep(2)} className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground text-[12px] font-bold rounded-lg hover:bg-primary/90 font-sans">Next <ArrowRight size={13} /></button>
          </div>
        </motion.div>
      )}

      {/* Step 2: Vehicle Status */}
      {step === 2 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-card/40 border border-border">
              <p className="text-[11px] uppercase font-sans font-semibold tracking-wide text-muted-foreground mb-3 flex items-center gap-1.5"><Fuel size={12} /> Fuel Level</p>
              <div className="flex gap-2 mb-3">
                {fuelLevels.map(level => (
                  <button key={level} onClick={() => setFuel(level)}
                    className={`flex-1 py-2 text-[11px] font-bold rounded-lg transition-all font-sans ${fuel === level ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"}`}>
                    {level}%
                  </button>
                ))}
              </div>
              <div className="h-3 rounded-full bg-card overflow-hidden">
                <motion.div animate={{ width: `${fuel}%` }} className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all" />
              </div>
            </div>
            <div className="p-4 rounded-xl bg-card/40 border border-border">
              <p className="text-[11px] uppercase font-sans font-semibold tracking-wide text-muted-foreground mb-3 flex items-center gap-1.5"><Wrench size={12} /> Vehicle Inventory</p>
              <div className="flex flex-col gap-2">
                {["Spare Tyre", "Service Schedule", "Wheel Cover", "Toolkit", "Music System"].map((item, i) => (
                  <label key={item} className="flex items-center gap-2 text-[12px] text-foreground cursor-pointer">
                    <input type="checkbox" defaultChecked={i < 3} className="w-3.5 h-3.5 accent-primary" />
                    {item}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="p-3 rounded-xl bg-[#1A1A0D]/40 border border-[#FACC15]/20 text-[#FACC15] text-[12px] flex items-start gap-2">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            Please capture at least 3 interior images before proceeding. Smart Eye process recommended for exterior.
          </div>
          <div className="flex justify-between">
            <button onClick={() => setStep(1)} className="flex items-center gap-2 px-4 py-2 bg-card text-foreground text-[12px] font-semibold rounded-lg hover:bg-muted font-sans"><ChevronLeft size={13} /> Back</button>
            <button onClick={() => setStep(3)} className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground text-[12px] font-bold rounded-lg hover:bg-primary/90 font-sans">Next <ArrowRight size={13} /></button>
          </div>
        </motion.div>
      )}

      {/* Step 3: Tyre & Battery */}
      {step === 3 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-card/40 border border-border">
              <p className="text-[11px] uppercase font-sans font-semibold tracking-wide text-muted-foreground mb-4">Tyre Health (mm)</p>
              <div className="grid grid-cols-2 gap-3">
                {(["fl", "fr", "rl", "rr"] as const).map(k => (
                  <div key={k} className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-sans font-semibold text-muted-foreground tracking-wide">{k.toUpperCase()}</label>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setTyre(t => ({ ...t, [k]: String(Math.max(0, parseInt(t[k]) - 1)) }))}
                        className="w-7 h-7 rounded-lg bg-card text-muted-foreground hover:text-foreground flex items-center justify-center"><Minus size={11} /></button>
                      <input value={tyre[k]} onChange={e => setTyre(t => ({ ...t, [k]: e.target.value }))}
                        className="flex-1 px-2 py-1.5 bg-card border border-border rounded-lg text-foreground text-center text-[13px] outline-none font-mono" />
                      <button onClick={() => setTyre(t => ({ ...t, [k]: String(parseInt(t[k]) + 1) }))}
                        className="w-7 h-7 rounded-lg bg-card text-muted-foreground hover:text-foreground flex items-center justify-center"><Plus size={11} /></button>
                    </div>
                    {parseInt(tyre[k]) < 3 && (
                      <p className="text-[#F87171] text-[10px] font-sans">Critical — replacement needed</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-card/40 border border-border">
              <p className="text-[11px] uppercase font-sans font-semibold tracking-wide text-muted-foreground mb-4">Battery Health</p>
              <div className="flex flex-col gap-2">
                {["Good", "Charge and Test", "Poor"].map(opt => (
                  <label key={opt} onClick={() => setBattery(opt)}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${battery === opt ? "border-primary bg-primary/10" : "border-border hover:border-border"}`}>
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${battery === opt ? "border-primary" : "border-muted-foreground"}`}>
                      {battery === opt && <div className="w-2 h-2 rounded-full bg-primary" />}
                    </div>
                    <span className={`text-[13px] font-sans font-semibold ${battery === opt ? "text-primary" : "text-foreground"}`}>{opt}</span>
                  </label>
                ))}
              </div>
              {battery === "Poor" && (
                <p className="text-[#F87171] text-[11px] mt-2 font-sans">Battery replacement demand will be auto-added.</p>
              )}
            </div>
          </div>
          <div className="flex justify-between">
            <button onClick={() => setStep(2)} className="flex items-center gap-2 px-4 py-2 bg-card text-foreground text-[12px] font-semibold rounded-lg hover:bg-muted font-sans"><ChevronLeft size={13} /> Back</button>
            <button onClick={() => setStep(4)} className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground text-[12px] font-bold rounded-lg hover:bg-primary/90 font-sans">Next <ArrowRight size={13} /></button>
          </div>
        </motion.div>
      )}

      {/* Step 4: Demands */}
      {step === 4 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[11px] text-muted-foreground uppercase font-sans font-semibold tracking-wide">Service Menu Detail List (Demanded Repair)</p>
            <button 
              onClick={() => { setShowAddDemandRow(!showAddDemandRow); setNewDesc(""); setNewCode(""); setNewPrice(0); setNewQty(1); }}
              className="flex items-center gap-1.5 text-primary text-[11px] font-semibold font-sans hover:text-accent transition-colors cursor-pointer"
            >
              <Plus size={12} /> Add Demand
            </button>
          </div>

          {showAddDemandRow && (
            <div className="p-4 rounded-xl border border-primary/20 bg-card flex flex-wrap gap-3 items-end transition-all">
              <div className="flex-1 min-w-[100px]">
                <label className="text-[10px] uppercase font-sans text-muted-foreground block mb-1 font-bold">Type</label>
                <select value={newType} onChange={e => setNewType(e.target.value as "L" | "P")} className="w-full text-[12px] px-3.5 py-2 bg-card border border-border rounded focus:border-primary/50 text-foreground outline-none cursor-pointer">
                  <option value="L">Labour (L)</option>
                  <option value="P">Part (P)</option>
                </select>
              </div>
              <div className="flex-[3] min-w-[200px]">
                <label className="text-[10px] uppercase font-sans text-muted-foreground block mb-1 font-bold">Description</label>
                <input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="e.g. Front Brake Pads Replacement" className="w-full text-[12px] px-3.5 py-2 bg-card border border-border rounded focus:border-primary/50 text-foreground outline-none font-sans" />
              </div>
              <div className="flex-1 min-w-[120px]">
                <label className="text-[10px] uppercase font-sans text-muted-foreground block mb-1 font-bold">Code</label>
                <input value={newCode} onChange={e => setNewCode(e.target.value.toUpperCase())} placeholder="e.g. BRK-PAD-01" className="w-full text-[12px] px-3.5 py-2 bg-card border border-border rounded focus:border-primary/50 text-foreground outline-none font-mono" />
              </div>
              <div className="w-[70px]">
                <label className="text-[10px] uppercase font-sans text-muted-foreground block mb-1 font-bold">Qty</label>
                <input type="number" value={newQty} onChange={e => setNewQty(parseInt(e.target.value) || 1)} className="w-full text-[12px] px-3.5 py-2 bg-card border border-border rounded focus:border-primary/50 text-foreground outline-none font-mono" />
              </div>
              <div className="w-[100px]">
                <label className="text-[10px] uppercase font-sans text-muted-foreground block mb-1 font-bold">Price (₹)</label>
                <input type="number" value={newPrice} onChange={e => setNewPrice(parseInt(e.target.value) || 0)} className="w-full text-[12px] px-3.5 py-2 bg-card border border-border rounded focus:border-primary/50 text-foreground outline-none font-mono" />
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => {
                    if (!newDesc.trim()) return;
                    setDemands(prev => [...prev, {
                      type: newType,
                      desc: newDesc,
                      code: newCode || (newType === "L" ? "LBR" : "PRT") + Math.trunc(Math.random() * 900 + 100),
                      qty: newQty,
                      price: newPrice,
                      accepted: true
                    }]);
                    setShowAddDemandRow(false);
                  }} 
                  className="px-4 py-2 bg-primary hover:bg-primary/95 text-white font-bold text-[12px] rounded font-sans cursor-pointer animate-pulse"
                >
                  ADD
                </button>
                <button 
                  onClick={() => setShowAddDemandRow(false)} 
                  className="px-4 py-2 bg-card border border-border text-foreground font-bold text-[12px] rounded font-sans cursor-pointer"
                >
                  CANCEL
                </button>
              </div>
            </div>
          )}
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-[11.5px]">
              <thead>
                <tr className="border-b border-border bg-card/60">
                  {["Type", "Description", "Part/Labour Code", "QTY", "Price", "Accepted"].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left font-semibold text-muted-foreground font-sans text-[10px] tracking-wide uppercase whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {demands.map((d, i) => (
                  <tr key={i} className="border-b border-border">
                    <td className="px-3 py-2.5">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-sans ${d.type === "L" ? "bg-primary/20 text-primary" : "bg-accent/20 text-accent"}`}>{d.type}</span>
                    </td>
                    <td className="px-3 py-2.5 text-foreground max-w-[140px] truncate">{d.desc}</td>
                    <td className="px-3 py-2.5 text-muted-foreground font-mono text-[10px]">{d.code}</td>
                    <td className="px-3 py-2.5 text-foreground font-mono">{d.qty}</td>
                    <td className="px-3 py-2.5 text-foreground font-mono">₹{d.price.toLocaleString()}</td>
                    <td className="px-3 py-2.5">
                      <span className="text-[#4ADE80] font-sans font-semibold text-[11px]">YES</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-between items-center p-3 rounded-xl bg-card/40 border border-border text-[12px] font-mono">
            <div className="flex gap-6">
              <span className="text-muted-foreground">Labour: <span className="text-foreground font-semibold">₹{labourTotal.toLocaleString()}</span></span>
              <span className="text-muted-foreground">Parts: <span className="text-foreground font-semibold">₹{partsTotal.toLocaleString()}</span></span>
            </div>
            <span className="text-foreground font-bold text-[14px]">Grand Total: ₹{(labourTotal + partsTotal).toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <button onClick={() => setStep(3)} className="flex items-center gap-2 px-4 py-2 bg-card text-foreground text-[12px] font-semibold rounded-lg hover:bg-muted font-sans"><ChevronLeft size={13} /> Back</button>
            <button onClick={() => setStep(5)} className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground text-[12px] font-bold rounded-lg hover:bg-primary/90 font-sans">Next <ArrowRight size={13} /></button>
          </div>
        </motion.div>
      )}

      {/* Step 5: Summary */}
      {step === 5 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4">
          <div className="p-4 rounded-xl bg-card/40 border border-border">
            <p className="text-[11px] uppercase font-sans font-semibold tracking-wide text-muted-foreground mb-3">Job Card Summary</p>
            <div className="grid grid-cols-3 gap-3 text-[12px] mb-4">
              <div><p className="text-muted-foreground text-[10px] uppercase font-sans tracking-wide mb-0.5">Registration</p><p className="text-primary font-mono">{regNo}</p></div>
              <div><p className="text-muted-foreground text-[10px] uppercase font-sans tracking-wide mb-0.5">Model</p><p className="text-foreground">MARUTI BALENO PETROL</p></div>
              <div><p className="text-muted-foreground text-[10px] uppercase font-sans tracking-wide mb-0.5">Service Type</p><p className="text-foreground">{serviceType}</p></div>
              <div><p className="text-muted-foreground text-[10px] uppercase font-sans tracking-wide mb-0.5">Odometer</p><p className="text-foreground font-mono">{parseInt(odometer).toLocaleString()} KMS</p></div>
              <div><p className="text-muted-foreground text-[10px] uppercase font-sans tracking-wide mb-0.5">Total Est. Amount</p><p className="text-foreground font-mono font-bold">₹{(labourTotal + partsTotal).toLocaleString()}</p></div>
              <div><p className="text-muted-foreground text-[10px] uppercase font-sans tracking-wide mb-0.5">Battery</p><p className="text-foreground">{battery}</p></div>
            </div>
            <div className="border-t border-border pt-3">
              <p className="text-[10px] uppercase font-sans font-semibold tracking-wide text-muted-foreground mb-2">Demand Repairs ({demands.length})</p>
              {demands.map((d, i) => (
                <div key={i} className="flex justify-between text-[11px] py-1 border-b border-border last:border-0">
                  <span className="text-foreground">{d.desc}</span>
                  <span className="text-muted-foreground font-mono">₹{(d.price * d.qty).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-card/40 border border-border">
            <p className="text-[10px] uppercase font-sans font-semibold tracking-wide text-muted-foreground mb-2">Customer Signature</p>
            <SignaturePad value={signatureData} onChange={setSignatureData} />
          </div>
          <div className="flex justify-between">
            <button onClick={() => setStep(4)} className="flex items-center gap-2 px-4 py-2 bg-card text-foreground text-[12px] font-semibold rounded-lg hover:bg-muted font-sans"><ChevronLeft size={13} /> Back</button>
            <button onClick={() => setSubmitted(true)}
              className="flex items-center gap-2 px-6 py-2.5 bg-[#4ADE80] text-[#070C16] text-[13px] font-bold rounded-lg hover:bg-[#4ADE80]/90 transition-all font-sans">
              <Zap size={14} /> Generate Job Card
            </button>
          </div>
        </motion.div>
      )}
    </div>
  )
}

export function generateJcPdf(jc: any, action: 'download' | 'print') {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pColor = [61, 142, 240]; // NEXA Blue Accent
  const dColor = [14, 22, 38];   // NEXA Dark Theme Tone
  const textDark = [33, 37, 41];
  const borderLight = 220;

  // Header Banner
  doc.setFillColor(dColor[0], dColor[1], dColor[2]);
  doc.rect(0, 0, 210, 40, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("NEXA Service", 15, 18);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("PREMIUM AUTOMOBILE WORKSPACE · HYPER-LOCAL DIGITAL LOGISTICS", 15, 24);
  
  doc.setFillColor(pColor[0], pColor[1], pColor[2]);
  doc.rect(145, 0, 65, 40, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("JOB CARD NO.", 152, 13);
  doc.setFontSize(15);
  doc.text(jc.jcNo || "JC-NEW", 152, 22);
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.text(`Date: ${jc.visitDate || "21-MAY-2026"}`, 152, 29);
  doc.text(`Gate In: ${jc.gateIn || "08:30 AM"}`, 152, 34);

  let curY = 50;

  const renderSectionHeader = (title: string, yPos: number) => {
    doc.setFillColor(242, 246, 253);
    doc.rect(15, yPos, 180, 8, 'F');
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(pColor[0], pColor[1], pColor[2]);
    doc.text(title.toUpperCase(), 19, yPos + 5.5);
  };

  // Section 1: Customer & Vehicle details
  renderSectionHeader("Customer & Vehicle Information", curY);
  curY += 14;

  const cust = jc.customer || {
    name: "Customer Name", mobile1: "+91 99999 88888", email: "customer@gmail.com",
    address: "DLF Phase 4, Gurugram", city: "Gurugram", regNo: jc.regNo || "HR26CW7677",
    vin: "MA3YFDS75K008432", model: jc.model || "MARUTI BALENO PETROL"
  };

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(33, 37, 41);

  // Column 1
  doc.setFont("helvetica", "bold"); doc.text("Customer Profile", 15, curY); curY += 5;
  doc.setFont("helvetica", "normal"); doc.text(`Name: ${cust.name}`, 15, curY); curY += 4.5;
  doc.text(`Mobile: ${cust.mobile1}`, 15, curY); curY += 4.5;
  doc.text(`Email: ${cust.email}`, 15, curY); curY += 4.5;
  doc.text(`Address: ${cust.address || ""}, ${cust.city || ""}`, 15, curY);

  // Column 2
  let col2Y = curY - 18.5;
  doc.setFont("helvetica", "bold"); doc.text("Vehicle Profile", 115, col2Y); col2Y += 5;
  doc.setFont("helvetica", "normal"); doc.text(`Model: ${cust.model || "MARUTI BALENO PETROL"}`, 115, col2Y); col2Y += 4.5;
  doc.text(`Reg No: ${cust.regNo || jc.regNo}`, 115, col2Y); col2Y += 4.5;
  doc.text(`Chassis/VIN: ${cust.vin || "MA3YFDS75K008432"}`, 115, col2Y); col2Y += 4.5;
  doc.text(`Odometer: ${(jc.odometer || 40002).toLocaleString()} KMS`, 115, col2Y);

  curY += 12;

  // Section 2: Job Card Logistics
  renderSectionHeader("Job Card Details & Assigned Staff", curY);
  curY += 14;

  // Column 1
  doc.setFont("helvetica", "bold"); doc.text("Logistics", 15, curY); curY += 5;
  doc.setFont("helvetica", "normal"); doc.text(`Service Type: ${jc.serviceType || "PAID SERVICE"}`, 15, curY); curY += 4.5;
  doc.text(`Promised Date: ${jc.promisedDate || "21-MAY-2026"} ${jc.promisedTime || "06:00 PM"}`, 15, curY); curY += 4.5;
  doc.text(`Payment Mode: ${jc.paymentMode || "CASH / DIGITAL"}`, 15, curY);

  // Column 2
  let logCol2Y = curY - 14;
  doc.setFont("helvetica", "bold"); doc.text("Workshop Setup", 115, logCol2Y); logCol2Y += 5;
  doc.setFont("helvetica", "normal"); doc.text(`Technician: ${jc.techName || "RAJESH KUMAR"}`, 115, logCol2Y); logCol2Y += 4.5;
  doc.text(`Assigned Bay: ${jc.bay || "BAY-03"}`, 115, logCol2Y); logCol2Y += 4.5;
  doc.text(`Workshop Dealer: ${jc.dealer || "PREM MOTORS PVT. LTD., GURGAON-2S(NEXA)"}`, 115, logCol2Y);

  curY += 14;

  // Section 3: Repairs voice
  renderSectionHeader("Demanded Repairs & Complaints Voice", curY);
  curY += 13;

  doc.setFillColor(248, 248, 248);
  doc.rect(15, curY, 180, 7, 'F');
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(33, 37, 41);
  doc.text("S.No", 18, curY + 4.5);
  doc.text("Ref Code", 35, curY + 4.5);
  doc.text("Repairs Requested & Customer Feedback", 65, curY + 4.5);
  doc.text("Repairs Type", 165, curY + 4.5);
  curY += 7;

  doc.setFont("helvetica", "normal");
  const dList = jc.demands || [];
  if (dList.length === 0) {
    doc.text("No specific demands associated.", 18, curY + 4);
    curY += 8;
  } else {
    dList.forEach((d: any, idx: number) => {
      doc.text(String(idx + 1), 18, curY + 4.5);
      doc.text(d.code || "DEM-01", 35, curY + 4.5);
      doc.text(d.desc || d.text || "—", 65, curY + 4.5);
      doc.text(d.type === "L" ? "Labor" : "Spare", 165, curY + 4.5);
      doc.setDrawColor(borderLight);
      doc.line(15, curY + 6.5, 195, curY + 6.5);
      curY += 7.5;
    });
  }

  curY += 8;

  // Check Page break
  if (curY > 230) {
    doc.addPage();
    curY = 20;
  }

  // Section 4: Labor & Parts Estimation tables
  renderSectionHeader("Financial Labor & Parts Cost Estimation", curY);
  curY += 13;

  // Labor Table Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(33, 37, 41);
  doc.text("Labor/Workshop Operations Breakdown", 15, curY);
  curY += 5;

  doc.setFillColor(248, 248, 248);
  doc.rect(15, curY, 180, 6, 'F');
  doc.setFontSize(8.5);
  doc.text("Code", 18, curY + 4);
  doc.text("Operation Description", 40, curY + 4);
  doc.text("Hrs", 115, curY + 4);
  doc.text("Billable", 135, curY + 4);
  doc.text("Total", 170, curY + 4);
  curY += 6;

  doc.setFont("helvetica", "normal");
  let customLaborTotal = 0;
  const lList = jc.labour || [];
  lList.forEach((l: any) => {
    doc.text(l.code, 18, curY + 4);
    doc.text(l.desc || "—", 40, curY + 4);
    doc.text(String(l.prnHrs || 1), 115, curY + 4);
    doc.text(l.billableType || "Billable", 135, curY + 4);
    doc.text(`INR ${(l.amount || 0).toLocaleString()}`, 170, curY + 4);
    customLaborTotal += (l.amount || 0);
    doc.setDrawColor(borderLight);
    doc.line(15, curY + 6, 195, curY + 6);
    curY += 7;
  });

  doc.setFont("helvetica", "bold");
  doc.text(`Labor Total: INR ${customLaborTotal.toLocaleString()}`, 135, curY + 3);
  curY += 12;

  if (curY > 230) {
    doc.addPage();
    curY = 20;
  }

  // Parts Table Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Recommended Spares & Lubricants", 15, curY);
  curY += 5;

  doc.setFillColor(248, 248, 248);
  doc.rect(15, curY, 180, 6, 'F');
  doc.setFontSize(8.5);
  doc.text("Part Number", 18, curY + 4);
  doc.text("Part Description", 40, curY + 4);
  doc.text("Qty", 115, curY + 4);
  doc.text("Rate", 135, curY + 4);
  doc.text("Total", 170, curY + 4);
  curY += 6;

  doc.setFont("helvetica", "normal");
  let customPartsTotal = 0;
  const pList = jc.parts || [];
  pList.forEach((p: any) => {
    doc.text(p.code, 18, curY + 4);
    doc.text(p.desc || "—", 40, curY + 4);
    doc.text(String(p.qty || 1), 115, curY + 4);
    doc.text(`INR ${(p.price || 0).toLocaleString()}`, 135, curY + 4);
    doc.text(`INR ${(p.amount || 0).toLocaleString()}`, 170, curY + 4);
    customPartsTotal += (p.amount || 0);
    doc.setDrawColor(borderLight);
    doc.line(15, curY + 6, 195, curY + 6);
    curY += 7;
  });

  doc.setFont("helvetica", "bold");
  doc.text(`Parts Total: INR ${customPartsTotal.toLocaleString()}`, 135, curY + 3);
  curY += 13;

  if (curY > 230) {
    doc.addPage();
    curY = 20;
  }

  // Total Summary
  doc.setFillColor(242, 246, 253);
  doc.rect(110, curY, 85, 25, 'F');
  doc.setFontSize(9.5);
  doc.text("GRAND ESTIMATED AMOUNT:", 114, curY + 8);
  doc.setFontSize(13);
  doc.setTextColor(pColor[0], pColor[1], pColor[2]);
  doc.text(`INR ${(customLaborTotal + customPartsTotal).toLocaleString()}`, 114, curY + 17);

  // Bottom text & line
  doc.setFontSize(8.5);
  doc.setTextColor(110, 110, 110);
  doc.setFont("helvetica", "normal");
  doc.text("Automated workshop ledger for representative audits only.", 15, curY + 8);
  doc.text("Awaiting secure customer approval via OCAS gateway links.", 15, curY + 14);
  doc.line(15, curY + 19, 80, curY + 19);
  doc.text("Workshop Advisor Signature", 15, curY + 23);

  if (action === 'download') {
    doc.save(`NEXA_JobCard_${jc.jcNo || "JC26000512"}.pdf`);
  } else {
    const sUrl = doc.output('bloburl');
    window.open(sUrl);
  }
}

// ── JC Detail Modal ───────────────────────────────────────────────────────────
function JCDetailModal({ jcNo, onClose }: { jcNo: string; onClose: () => void }) {
  const [tab, setTab] = useState(0)
  const jc = JC_DETAILS[jcNo]
  if (!jc) return null

  const tabs = ["JC Details", "Customer & Vehicle", "Demanded Repairs", "Labour & Parts", "Pricing"]
  const labourTotal = jc.labour.reduce((s, l) => s + l.amount, 0)
  const partsTotal = jc.parts.reduce((s, p) => s + p.amount, 0)
  const grandTotal = labourTotal + partsTotal

  const Field = ({ label, value, mono = false }: { label: string; value: string | number; mono?: boolean }) => (
    <div className="flex flex-col gap-0.5">
      <p className="text-[9px] uppercase tracking-wide text-muted-foreground font-sans font-semibold">{label}</p>
      <p className={`text-[12px] text-foreground ${mono ? "font-mono" : "font-sans font-semibold"}`}>{value || "—"}</p>
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }} transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="relative w-full max-w-4xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-background border-b border-border">
          <div className="flex items-center gap-4">
            <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
              <FileText size={16} className="text-primary" />
            </div>
            <div>
              <p className="text-[16px] font-bold font-sans text-foreground tracking-wide">Job Card — <span className="text-primary font-mono">{jc.jcNo}</span></p>
              <p className="text-[11px] text-muted-foreground">{jc.customer.model} · {jc.customer.regNo} · {jc.visitDate}</p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-lg bg-card hover:bg-muted border border-border flex items-center justify-center transition-colors text-muted-foreground hover:text-foreground text-[16px] font-bold">
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border bg-background px-4 gap-0.5 overflow-x-auto">
          {tabs.map((t, i) => (
            <button key={i} onClick={() => setTab(i)}
              className={`px-4 py-3 text-[11px] font-semibold font-sans tracking-wide whitespace-nowrap transition-all border-b-2 ${tab === i
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-primary/30"}`}>
              {t}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">
            {tab === 0 && (
              <motion.div key="tab0" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} className="grid grid-cols-3 gap-x-8 gap-y-5">
                <Field label="JC Number" value={jc.jcNo} mono />
                <Field label="Dealer" value={jc.dealer} />
                <Field label="Dealer Map Code" value={jc.dealerMapCode} mono />
                <Field label="Visit Date" value={jc.visitDate} />
                <Field label="Gate In Time" value={jc.gateIn} mono />
                <Field label="Service Type" value={jc.serviceType} />
                <Field label="Billed Date" value={jc.billedDate} />
                <Field label="Technician" value={jc.techName} />
                <Field label="Bay" value={jc.bay} />
                <Field label="Group" value={jc.group} />
                <Field label="Pin Status" value={jc.pinStatus} />
                <Field label="Attended Through" value={jc.attendedThrough} />
                <Field label="Odometer (KMS)" value={jc.odometer.toLocaleString()} mono />
                <Field label="Payment Mode" value={jc.paymentMode} />
                <Field label="Promised Date & Time" value={`${jc.promisedDate} ${jc.promisedTime}`} />
                <div className="col-span-3 border-t border-border pt-4 mt-1">
                  <p className="text-[9px] uppercase tracking-wide text-muted-foreground font-sans font-semibold mb-1.5">Remark</p>
                  <p className="text-[12px] text-foreground font-sans font-semibold">{jc.remark}</p>
                </div>
                <div className="col-span-3">
                  <p className="text-[9px] uppercase tracking-wide text-muted-foreground font-sans font-semibold mb-1.5">Unauthorized Fitments</p>
                  <p className={`text-[12px] font-sans font-semibold ${jc.unauthorizedFitments === "None" ? "text-[#4ADE80]" : "text-[#F87171]"}`}>{jc.unauthorizedFitments}</p>
                </div>
              </motion.div>
            )}
            {tab === 1 && (
              <motion.div key="tab1" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} className="flex flex-col gap-6">
                <div>
                  <p className="text-[11px] uppercase font-sans font-bold tracking-widest text-primary mb-4">Customer Information</p>
                  <div className="grid grid-cols-3 gap-x-8 gap-y-5">
                    <Field label="Customer Name" value={jc.customer.name} />
                    <Field label="Mobile 1" value={jc.customer.mobile1} mono />
                    <Field label="Mobile 2" value={jc.customer.mobile2 || "—"} mono />
                    <Field label="Email" value={jc.customer.email} />
                    <Field label="Customer Category" value={jc.customer.customerCategory} />
                    <div className="col-span-1" />
                    <div className="col-span-3">
                      <Field label="Address" value={jc.customer.address} />
                    </div>
                    <Field label="State" value={jc.customer.state} />
                    <Field label="City" value={jc.customer.city} />
                    <Field label="Pin Code" value={jc.customer.pinCode} mono />
                  </div>
                </div>
                <div className="border-t border-border pt-6">
                  <p className="text-[11px] uppercase font-sans font-bold tracking-widest text-accent mb-4">Vehicle Information</p>
                  <div className="grid grid-cols-3 gap-x-8 gap-y-5">
                    <Field label="Registration No." value={jc.customer.regNo} mono />
                    <Field label="Model" value={jc.customer.model} />
                    <Field label="Variant" value={jc.customer.variant} />
                    <Field label="VIN / Chassis No." value={jc.customer.vin} mono />
                    <Field label="Sale Date" value={jc.customer.saleDate} />
                    <Field label="TV Sale Date" value={jc.customer.tvSaleDate} />
                    <Field label="FC OK Date" value={jc.customer.fcOkDate} />
                  </div>
                </div>
              </motion.div>
            )}
            {tab === 2 && (
              <motion.div key="tab2" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}>
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full text-[11.5px]">
                    <thead>
                      <tr className="border-b border-border bg-card/60">
                        {["S.No", "Type", "Demand Code", "Demand Description", "Customer Voice"].map(h => (
                          <th key={h} className="px-3 py-2.5 text-left font-semibold text-muted-foreground font-sans text-[10px] tracking-wide uppercase whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {jc.demands.map((d, i) => (
                        <tr key={i} className="border-b border-border hover:bg-card/20 transition-colors">
                          <td className="px-3 py-3 text-muted-foreground font-mono">{d.sno}</td>
                          <td className="px-3 py-3">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-sans ${d.type === "L" ? "bg-primary/20 text-primary" : "bg-accent/20 text-accent"}`}>{d.type}</span>
                          </td>
                          <td className="px-3 py-3 text-muted-foreground font-mono text-[10px]">{d.code}</td>
                          <td className="px-3 py-3 text-foreground font-sans font-semibold">{d.desc}</td>
                          <td className="px-3 py-3 text-muted-foreground italic">{d.voice}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}
            {tab === 3 && (
              <motion.div key="tab3" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} className="flex flex-col gap-6">
                <div>
                  <p className="text-[11px] uppercase font-sans font-bold tracking-widest text-primary mb-3">Labour</p>
                  <div className="overflow-x-auto rounded-xl border border-border">
                    <table className="w-full text-[11.5px]">
                      <thead>
                        <tr className="border-b border-border bg-card/60">
                          {["S.No", "Labour Code", "Description", "Qty", "PRN Hrs", "Billable Type", "Amount"].map(h => (
                            <th key={h} className="px-3 py-2.5 text-left font-semibold text-muted-foreground font-sans text-[10px] tracking-wide uppercase whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {jc.labour.map((l, i) => (
                          <tr key={i} className="border-b border-border hover:bg-card/20 transition-colors">
                            <td className="px-3 py-2.5 text-muted-foreground font-mono">{l.sno}</td>
                            <td className="px-3 py-2.5 text-muted-foreground font-mono text-[10px]">{l.code}</td>
                            <td className="px-3 py-2.5 text-foreground font-sans font-semibold max-w-[160px]">{l.desc}</td>
                            <td className="px-3 py-2.5 text-foreground font-mono">{l.qty}</td>
                            <td className="px-3 py-2.5 text-foreground font-mono">{l.prnHrs}</td>
                            <td className="px-3 py-2.5">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold font-sans bg-primary/10 text-primary">{l.billableType}</span>
                            </td>
                            <td className="px-3 py-2.5 text-foreground font-mono font-medium">₹{l.amount.toLocaleString()}</td>
                          </tr>
                        ))}
                        <tr className="bg-card/40">
                          <td colSpan={6} className="px-3 py-2 text-right text-[11px] font-bold text-muted-foreground font-sans uppercase tracking-wide">Labour Total</td>
                          <td className="px-3 py-2 text-primary font-mono font-bold">₹{labourTotal.toLocaleString()}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
                <div>
                  <p className="text-[11px] uppercase font-sans font-bold tracking-widest text-accent mb-3">Parts</p>
                  <div className="overflow-x-auto rounded-xl border border-border">
                    <table className="w-full text-[11.5px]">
                      <thead>
                        <tr className="border-b border-border bg-card/60">
                          {["S.No", "Part Code", "Description", "Qty", "Price", "Amount"].map(h => (
                            <th key={h} className="px-3 py-2.5 text-left font-semibold text-muted-foreground font-sans text-[10px] tracking-wide uppercase whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {jc.parts.map((p, i) => (
                          <tr key={i} className="border-b border-border hover:bg-card/20 transition-colors">
                            <td className="px-3 py-2.5 text-muted-foreground font-mono">{p.sno}</td>
                            <td className="px-3 py-2.5 text-muted-foreground font-mono text-[10px]">{p.code}</td>
                            <td className="px-3 py-2.5 text-foreground font-sans font-semibold">{p.desc}</td>
                            <td className="px-3 py-2.5 text-foreground font-mono">{p.qty}</td>
                            <td className="px-3 py-2.5 text-foreground font-mono">₹{p.price.toLocaleString()}</td>
                            <td className="px-3 py-2.5 text-foreground font-mono font-medium">₹{p.amount.toLocaleString()}</td>
                          </tr>
                        ))}
                        <tr className="bg-card/40">
                          <td colSpan={5} className="px-3 py-2 text-right text-[11px] font-bold text-muted-foreground font-sans uppercase tracking-wide">Parts Total</td>
                          <td className="px-3 py-2 text-accent font-mono font-bold">₹{partsTotal.toLocaleString()}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}
            {tab === 4 && (
              <motion.div key="tab4" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: "Scheduled Labour Amount", value: jc.pricing.scheduledLabour, color: "text-primary" },
                    { label: "Scheduled Parts Amount", value: jc.pricing.scheduledParts, color: "text-accent" },
                    { label: "Estimated Labour Cost", value: jc.pricing.estLabour, color: "text-primary" },
                    { label: "Estimated Parts Cost", value: jc.pricing.estParts, color: "text-accent" },
                  ].map((item, i) => (
                    <div key={i} className="p-4 rounded-xl bg-card/40 border border-border flex flex-col gap-1">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-sans font-semibold">{item.label}</p>
                      <p className={`text-[20px] font-bold font-mono ${item.color}`}>₹{item.value.toLocaleString()}</p>
                    </div>
                  ))}
                </div>
                <div className="p-5 rounded-xl bg-gradient-to-r from-primary/10 to-accent/5 border border-primary/30 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-sans font-semibold">Grand Total (Tax not included)</p>
                    <p className="text-[28px] font-bold font-mono text-foreground mt-1">₹{grandTotal.toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase text-muted-foreground font-sans font-semibold mb-1">Payment Mode</p>
                    <p className="text-[14px] font-bold font-sans text-foreground">{jc.paymentMode}</p>
                    <p className="text-[10px] text-muted-foreground font-sans mt-0.5">Promised by {jc.promisedDate} {jc.promisedTime}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 text-[11px]">
                  <div className="p-3 rounded-lg bg-card/30 border border-border text-center">
                    <p className="text-muted-foreground font-sans mb-0.5">Labour</p>
                    <p className="text-primary font-bold font-mono">₹{labourTotal.toLocaleString()}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-card/30 border border-border text-center">
                    <p className="text-muted-foreground font-sans mb-0.5">Parts</p>
                    <p className="text-accent font-bold font-mono">₹{partsTotal.toLocaleString()}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-card/30 border border-border text-center">
                    <p className="text-muted-foreground font-sans mb-0.5">Items</p>
                    <p className="text-foreground font-bold font-mono">{jc.labour.length + jc.parts.length}</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer Action Buttons */}
        <div className="px-6 py-4 bg-background border-t border-border flex items-center justify-between gap-3">
          <div className="flex gap-2">
            <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-card hover:bg-muted border border-border text-[11px] font-semibold font-sans text-muted-foreground hover:text-foreground transition-all">
              <Mail size={12} /> Email JC
            </button>
            <button 
              onClick={() => generateJcPdf(jc, 'print')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-card hover:bg-muted border border-border text-[11px] font-semibold font-sans text-muted-foreground hover:text-foreground transition-all cursor-pointer"
            >
              <Eye size={12} /> View JC
            </button>
            <button 
              onClick={() => generateJcPdf(jc, 'print')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-card hover:bg-muted border border-border text-[11px] font-semibold font-sans text-muted-foreground hover:text-foreground transition-all cursor-pointer"
            >
              <Printer size={12} /> Print JC
            </button>
            <button 
              onClick={() => generateJcPdf(jc, 'download')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-card hover:bg-muted border border-border text-[11px] font-semibold font-sans text-muted-foreground hover:text-foreground transition-all cursor-pointer"
            >
              <Download size={12} /> Download JC
            </button>
            <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-card hover:bg-muted border border-border text-[11px] font-semibold font-sans text-muted-foreground hover:text-foreground transition-all">
              <Hash size={12} /> Probing Sheet
            </button>
          </div>
          <button className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-[11px] font-bold font-sans text-white transition-all">
            <RefreshCw size={12} /> OCAS Status
          </button>
        </div>
      </motion.div>
    </div>
  )
}


// ── TAB1 Action Modal ──────────────────────────────────────────────────────────
function Tab1ActionModal({ 
  jcNo, 
  onClose, 
  onSelectAction 
}: { 
  jcNo: string; 
  onClose: () => void; 
  onSelectAction: (act: "find_id" | "update" | "close") => void 
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm" 
        onClick={onClose} 
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }} 
        animate={{ opacity: 1, scale: 1 }} 
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl p-6 overflow-hidden z-10 flex flex-col gap-4 font-sans text-white"
      >
        <div className="flex justify-between items-center pb-2 border-b border-border">
          <p className="text-[14px] font-bold font-sans uppercase tracking-wider text-primary">TAB1 Action Panel</p>
          <button onClick={onClose} className="text-muted-foreground hover:text-white font-bold text-lg leading-none cursor-pointer">×</button>
        </div>
        <div className="text-center py-2">
          <p className="text-[12px] text-muted-foreground">Select Required Action for</p>
          <p className="text-[15px] font-bold text-secondary font-mono mt-1">{jcNo}</p>
        </div>
        <div className="flex flex-col gap-2.5">
          <button 
            onClick={() => onSelectAction("update")}
            className="w-full py-2.5 text-[12px] font-bold text-[#FACC15] border border-[#FACC15]/30 hover:border-[#FACC15] hover:bg-[#FACC15]/5 rounded-xl transition-all cursor-pointer font-sans uppercase tracking-wider bg-card/30"
          >
            Update Jobcard
          </button>
          <button 
            onClick={() => onSelectAction("close")}
            className="w-full py-2.5 text-[12.5px] font-bold text-white bg-primary hover:bg-primary/95 rounded-xl transition-all cursor-pointer font-sans uppercase tracking-wider shadow-lg shadow-primary/20"
          >
            ✅ Close Jobcard
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ── Close Job Card Panel ──────────────────────────────────────────────────────
function CloseJobCardPanel({ 
  initialReg, 
  initialJcNo, 
  onBack 
}: { 
  initialReg?: string; 
  initialJcNo?: string; 
  onBack: () => void 
}) {
  const selectedJcNo = initialJcNo || "JH10CK2349";
  const jc = JC_DETAILS[selectedJcNo] || JC_DETAILS["JH10CK2349"];

  const [step, setStep] = useState(0);

  // Error/validation messages
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // States
  const [odometer, setOdometer] = useState(jc.odometer ? String(jc.odometer) : "42376");
  const [mobile1, setMobile1] = useState(jc.customer.mobile1 || "9876543210");
  const [mobile2, setMobile2] = useState(jc.customer.mobile2 || "");
  const [email, setEmail] = useState(jc.customer.email || jc.customer.email || "amit.sharma@email.com");
  const [revisedDate, setRevisedDate] = useState("03-SEP-2025 12:44");

  const [bay, setBay] = useState(jc.bay || "");
  const [group, setGroup] = useState(jc.group || "Other Group 2");
  const [technician, setTechnician] = useState(jc.techName || "");
  const [techExpert, setTechExpert] = useState("Expert 2");
  const [followUpDate, setFollowUpDate] = useState("25-MAY-2026");
  const [csPercent, setCsPercent] = useState("85");
  const [followUpDoneBy, setFollowUpDoneBy] = useState("CEO");
  const [ceoApprovalStatus, setCeoApprovalStatus] = useState("NOT REQUIRED");
  const [roadTestStartKms, setRoadTestStartKms] = useState("42300");
  const [roadTestEndKms, setRoadTestEndKms] = useState("42350");
  const [roadTestStartTime, setRoadTestStartTime] = useState("10:00");
  const [roadTestEndTime, setRoadTestEndTime] = useState("10:15");

  const [fuelLevel, setFuelLevel] = useState("1/2");
  const [interiorImagesCount, setInteriorImagesCount] = useState(3);
  const [underbodyCheck, setUnderbodyCheck] = useState(true);
  const [scratches, setScratches] = useState(1);
  const [dents, setDents] = useState(2);
  const [fuelCapacity, setFuelCapacity] = useState("50%");

  const [paymentMode, setPaymentMode] = useState("UPI");

  const [demands, setDemands] = useState<any[]>(() => {
    return jc.demands ? jc.demands.map((d, i) => ({
      sno: i + 1,
      code: d.code || "VZ00305",
      desc: d.desc || "VEHICLE WASHING AND CLEANING",
      reported_by: "Customer",
      attended: true,
      carry_forward: false,
      ew_wty: false,
      problemCode: "P001",
      faultCode: "FA09",
      actionCode: "AC45"
    })) : [
      { sno: 1, code: "VZ00305", desc: "VEHICLE WASHING AND CLEANING", reported_by: "Customer", attended: true, carry_forward: false, ew_wty: false, problemCode: "P001", faultCode: "FA09", actionCode: "AC45" }
    ];
  });
  const [recordVoiceActive, setRecordVoiceActive] = useState(false);
  const [voiceSec, setVoiceSec] = useState(0);

  const [problemCode, setProblemCode] = useState("P001");
  const [faultCode, setFaultCode] = useState("FA09");
  const [actionCode, setActionCode] = useState("AC45");
  const [commentText, setCommentText] = useState("");

  const [labourItems, setLabourItems] = useState<any[]>(() => {
    return jc.labour ? jc.labour.map((l, i) => ({
      sno: i + 1,
      code: l.code,
      desc: l.desc,
      price: l.amount,
      billableType: l.billableType || "Customer"
    })) : [
      { sno: 1, code: "ZA1HLO", desc: "Alignment Out", price: 575, billableType: "Customer" },
      { sno: 2, code: "ZA15LO", desc: "Brake Cleaning", price: 450, billableType: "Customer" }
    ];
  });

  const [partsItems, setPartsItems] = useState<any[]>(() => {
    return jc.parts ? jc.parts.map((p, i) => ({
      sno: i + 1,
      code: p.code,
      name: p.desc,
      price: p.price || p.amount,
      qty: p.qty,
      amount: p.amount
    })) : [
      { sno: 1, code: "68510-68L10", name: "Engine Oil (4L)", price: 1200, qty: 1, amount: 1200 }
    ];
  });

  const [showAddLabour, setShowAddLabour] = useState(false);
  const [showAddParts, setShowAddParts] = useState(false);
  const [labourDiscPercent, setLabourDiscPercent] = useState("0");
  const [authBy, setAuthBy] = useState("ASHWANI CHAUHAN");

  // Loyalty Points (CCP)
  const [ccpCard, setCcpCard] = useState("77000291241");
  const [ccpMobile, setCcpMobile] = useState(jc.customer.mobile1 || "9847058853");
  const [ccpPoints, setCcpPoints] = useState("542");
  const [ccpRedeemVal, setCcpRedeemVal] = useState("");
  const [ccpOtpVal, setCcpOtpVal] = useState("");

  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpConfirmed, setOtpConfirmed] = useState(false);
  const [isPreinvoicePdfSimulated, setIsPreinvoicePdfSimulated] = useState(false);
  const [isPreinvoiceEmailed, setIsPreinvoiceEmailed] = useState(false);

  // Pick up & Drop
  const [pickupType, setPickupType] = useState("2. Drop Only");
  const [pickupLoc, setPickupLoc] = useState("Location 2");
  const [pickupAddr, setPickupAddr] = useState("N/A");
  const [pickupRemarks, setPickupRemarks] = useState("N/A");
  const [pickupTimeDate, setPickupTimeDate] = useState("02-SEP-2025 00:00");
  const [pndAssociate, setPndAssociate] = useState("Associate 2");
  const [sameAsPickup, setSameAsPickup] = useState(false);
  const [dropTimeDate, setDropTimeDate] = useState("03-SEP-2025 18:00");
  const [dropLoc, setDropLoc] = useState("Location 2");
  const [dropAddr, setDropAddr] = useState("Address Gurgaon Sec 15");
  const [dropAssociate, setDropAssociate] = useState("Associate 2");

  // TCS details
  const [tcsCust, setTcsCust] = useState("NO");
  const [tcsIns, setTcsIns] = useState("NO");
  const [tcsEwrVal, setTcsEwrVal] = useState("NO");

  // Flow modallings
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showSuccessCard, setShowSuccessCard] = useState(false);

  // Trigger Toast
  function triggerToast(text: string) {
    setToastMsg(text);
    setTimeout(() => {
      setToastMsg((prev) => (prev === text ? null : prev));
    }, 4000);
  }

  // Cost calculations
  const labourSubtotal = labourItems.reduce((acc, x) => acc + x.price, 0);
  const discAmt = Math.round((labourSubtotal * Number(labourDiscPercent)) / 100);
  const labourTotal = labourSubtotal - discAmt;
  const partsTotal = partsItems.reduce((acc, x) => acc + x.price * x.qty, 0);
  const netTotal = labourTotal + partsTotal;
  const grandTotal = netTotal - (otpConfirmed && ccpRedeemVal ? Math.min(Number(ccpRedeemVal) || 0, Number(ccpPoints)) : 0);

  // Handle NEXT / Submit
  function handleNextStep() {
    if (step === 0) {
      if (!odometer.toString().trim()) {
        triggerToast("Odometer reading is mandatory before proceeding!");
        return;
      }
      setStep(1);
    } else if (step === 1) {
      if (!bay.trim() || !technician.trim()) {
        triggerToast("BAY and TECHNICIAN are mandatory!");
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (interiorImagesCount < 3) {
        triggerToast("Please capture interior images — minimum 3 mandatory!");
        return;
      }
      setStep(3);
    } else if (step === 3) {
      if (!paymentMode) {
        triggerToast("Payment mode is required to proceed!");
        return;
      }
      setStep(4);
    } else if (step === 4) {
      if (demands.length === 0) {
        triggerToast("At least one demand repair entry is required!");
        return;
      }
      setStep(5);
    } else if (step === 5) {
      setStep(6);
    } else if (step === 6) {
      if (otpSent && !otpConfirmed) {
        triggerToast("Please confirm OTP or tap Skip to continue without redemption");
        return;
      }
      setStep(7);
    } else if (step === 7) {
      // Prompt 10: Confirmation Dialog
      setShowConfirmation(true);
    } else if (step === 8) {
      setStep(9);
    }
  }

  function handlePrevStep() {
    if (step > 0) {
      setStep(step - 1);
    } else {
      onBack();
    }
  }

  const stepsLabels = [
    "Cust & Veh",
    "JC Details",
    "Veh Status",
    "Service Menu",
    "Demands",
    "Labour/Parts",
    "Loyalty (CCP)",
    "Pick & Drop",
    "TCS details",
    "Pre-Invoice"
  ];

  // Hotspots toggles
  const [scratchDot, setScratchDot] = useState<number[]>([1, 4, 8]);
  const [dentDot, setDentDot] = useState<number[]>([2, 5]);

  // AI Walkaround and Live Scanner states
  const [videoAnalyzing, setVideoAnalyzing] = useState(false);
  const [videoPlayProgress, setVideoPlayProgress] = useState(0);
  const [showLiveScanner, setShowLiveScanner] = useState(false);

  return (
    <div className="relative flex flex-col h-full bg-background text-foreground overflow-hidden font-sans">
      
      {/* Absolute Toast */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-[#EF4444] text-white text-[12px] font-bold px-4 py-2.5 rounded-lg shadow-xl flex items-center gap-2 border border-red-500/30"
          >
            <AlertTriangle size={14} />
            {toastMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmation Step 10 Modal */}
      {showConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="bg-card border border-[#155DFC]/20 p-6 rounded-2xl max-w-sm w-full text-center flex flex-col gap-4">
            <AlertTriangle className="text-amber-500 mx-auto" size={40} />
            <h4 className="text-[15px] font-bold font-sans uppercase tracking-wider text-foreground">Verification Check</h4>
            <p className="text-[12.5px] text-muted-foreground">Please make sure all the information filled by you is correct. Do you wish to continue?</p>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <button 
                onClick={() => setShowConfirmation(false)} 
                className="py-2 rounded-lg border border-border text-[12px] text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
              >
                NO
              </button>
              <button 
                onClick={() => {
                  setShowConfirmation(false);
                  setStep(8); // Go to TCS Tax Details
                }} 
                className="py-2 rounded-lg bg-primary text-primary-foreground text-[12px] font-bold hover:bg-primary-hover transition-all"
              >
                YES (CONTINUE)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <div className="bg-card border border-[#4ADE80]/30 p-8 rounded-2xl max-w-md w-full text-center flex flex-col gap-4 shadow-2xl justify-center items-center">
            <div className="w-16 h-16 rounded-full bg-[#10B981]/15 flex items-center justify-center border-2 border-[#10B981] animate-pulse">
              <Check className="text-[#10B981]" size={36} />
            </div>
            <h3 className="text-[18px] font-black font-sans uppercase text-[#10B981]">Job Card Closed Successfully!</h3>
            <div className="bg-background border border-border p-4 rounded-xl w-full text-[12px] font-mono text-left flex flex-col gap-1.5 mt-2">
              <p><span className="text-muted-foreground">Invoice No:</span> <strong className="text-foreground">INV-2026-NEXA3802</strong></p>
              <p><span className="text-muted-foreground">Registration:</span> <strong className="text-foreground">{jc.customer.regNo}</strong></p>
              <p><span className="text-muted-foreground">Total Paid:</span> <strong className="text-green-500">₹ {grandTotal.toLocaleString()}</strong></p>
              <p><span className="text-muted-foreground">DMS Status:</span> <strong className="text-blue-500">INVOICE GENERATED & REPORTED ✅</strong></p>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Invoice SMS and email delivered to {jc.customer.name}</p>
            <div className="grid grid-cols-2 gap-2 w-full mt-4">
              <button 
                onClick={() => {
                  const doc = new jsPDF();
                  doc.setFont("courier", "bold");
                  doc.text("SUZUKI NEXA JOB CARD INVOICE", 15, 15);
                  doc.text(`Invoice No: INV-2026-NEXA3802`, 15, 25);
                  doc.text(`CustomerName: ${jc.customer.name}`, 15, 35);
                  doc.text(`Vehicle No: ${jc.customer.regNo}`, 15, 45);
                  doc.text(`Final Amount Billed: Rs. ${grandTotal}`, 15, 55);
                  doc.text("Job Card Status: Closed Successfully", 15, 65);
                  doc.save(`Invoice_${jc.jcNo}.pdf`);
                }} 
                className="py-2 px-3 border border-border hover:bg-secondary rounded-lg text-[11px] font-bold text-foreground transition-all flex items-center justify-center gap-1"
              >
                <Download size={12} /> Save PDF
              </button>
              <button 
                onClick={() => {
                  alert("Invoice sent successfully to " + email);
                }} 
                className="py-2 px-3 border border-border hover:bg-secondary rounded-lg text-[11px] font-bold text-foreground transition-all flex items-center justify-center gap-1"
              >
                <Mail size={12} /> Email Invoice
              </button>
            </div>
            <button 
              onClick={onBack} 
              className="mt-2 w-full py-2.5 bg-primary hover:bg-primary/90 text-white text-[12px] font-black rounded-lg transition-all font-sans uppercase tracking-wider shadow-lg"
            >
              Back to Workplace
            </button>
          </div>
        </div>
      )}

      {/* Header bar */}
      <div className="bg-background border-b border-border px-4 h-12 flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-3">
          <button onClick={handlePrevStep} className="flex items-center gap-1 text-[11.5px] font-bold text-muted-foreground hover:text-white transition-colors cursor-pointer">
            <ChevronLeft size={14} /> Back
          </button>
          <div className="h-4 w-[1px] bg-border/20" />
          <p className="text-[12.5px] font-black tracking-widest font-sans text-primary uppercase">CLOSE JOB CARD</p>
          <span className="text-[10px] font-mono text-muted-foreground bg-card px-2 py-0.5 rounded border border-border">{jc.jcNo}</span>
        </div>
        <div className="flex items-center gap-4 text-[10.5px] font-semibold text-muted-foreground">
          <div className="flex gap-1.5 items-center">
            <span className="text-primary font-mono font-bold">{jc.customer.regNo}</span> · <span className="uppercase text-white">{jc.customer.model}</span>
          </div>
          <p className="font-mono text-white">v11.2 DEV</p>
        </div>
      </div>

      {/* Progress step dots */}
      <div className="bg-background border-b border-border py-2.5 px-4 flex items-center gap-1.5 overflow-x-auto select-none scrollbar-none shrink-0">
        {stepsLabels.map((lab, i) => (
          <React.Fragment key={i}>
            {i > 0 && <div className={`h-[1.5px] w-4 shrink-0 rounded ${step >= i ? "bg-primary" : "bg-border/20"}`} />}
            <button 
              onClick={() => {
                // SAs can jump to any previous step or next if allowed. Let's let them navigate easily.
                if (i <= step) setStep(i);
              }}
              className={`flex items-center gap-1.5 px-3 py-1 text-[10.5px] font-bold rounded-full border transition-all shrink-0 font-sans uppercase ${
                step === i 
                  ? "bg-primary text-primary-foreground border-primary" 
                  : step > i 
                    ? "bg-card/30 text-primary border-primary/30" 
                    : "text-muted-foreground border-border"
              }`}
            >
              <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] ${step > i ? "bg-[#10B981]/20 text-[#10B981]" : "bg-black/20"}`}>
                {step > i ? "✓" : i + 2}
              </div>
              {lab}
            </button>
          </React.Fragment>
        ))}
      </div>

      {/* Persistent Details Strip */}
      <div className="bg-background/25 px-4 py-2 border-b border-border grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10.5px] shrink-0 font-sans">
        <div>
          <p className="text-muted-foreground uppercase text-[8px] font-bold font-sans">Jobcard Opened</p>
          <p className="text-white font-semibold mt-0.5">02-SEP-2025 12:45</p>
        </div>
        <div>
          <p className="text-muted-foreground uppercase text-[8px] font-bold font-sans">Est. Delivery Target</p>
          <p className="text-white font-semibold mt-0.5">03-SEP-2025 12:44</p>
        </div>
        <div>
          <p className="text-muted-foreground uppercase text-[8px] font-bold font-sans flex items-center gap-1">Revised Target ✏️</p>
          <input 
            value={revisedDate}
            onChange={(e) => setRevisedDate(e.target.value)}
            className="text-primary font-bold bg-transparent outline-none border-b border-transparent focus:border-primary/50 mt-0.5 cursor-pointer max-w-[124px]"
          />
        </div>
        <div>
          <p className="text-muted-foreground uppercase text-[8px] font-bold font-sans">Estimations (Current)</p>
          <p className="text-primary font-black mt-0.5">₹ {grandTotal.toLocaleString()} <span className="text-muted-foreground font-light text-[9.5px]">(Excl. tax)</span></p>
        </div>
      </div>

      {/* Main step container */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-background">
        <div className="max-w-4xl mx-auto w-full flex flex-col gap-5">
          
          {step === 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4">
              <h3 className="text-[15px] font-bold font-sans text-primary uppercase tracking-wide border-b border-border pb-1">CUSTOMER & VEHICLE DETAILS</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Odometer column */}
                <div className="bg-card border border-border p-4 rounded-xl flex flex-col gap-2.5">
                  <p className="text-[12px] font-bold font-sans text-secondary uppercase">Current Operations</p>
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-1 uppercase font-bold">Odometer Value (KMS) *</label>
                    <input 
                      type="number" 
                      value={odometer} 
                      onChange={(e) => setOdometer(e.target.value)}
                      placeholder="e.g. 42376"
                      className="w-full bg-card border border-border rounded-lg py-2 px-3 text-[12.5px] outline-none text-white focus:border-primary/50 font-mono font-bold"
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground italic mt-1">Note: Odometer measurement is highly critical for running campaigns audit.</p>
                </div>

                {/* Patient Contacts Info */}
                <div className="col-span-2 bg-card border border-border p-4 rounded-xl grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="sm:col-span-2 border-b border-border pb-1">
                    <p className="text-[11px] font-bold font-sans text-secondary uppercase">Contact & DMS Sync Profile</p>
                  </div>
                  <div>
                    <label className="text-[9.5px] text-muted-foreground block mb-0.5 uppercase">Customer Name</label>
                    <p className="text-[12px] font-bold text-white mt-0.5 uppercase">{jc.customer.name}</p>
                  </div>
                  <div>
                    <label className="text-[9.5px] text-muted-foreground block mb-0.5 uppercase">Registration Number</label>
                    <span className="text-[11.5px] font-mono text-primary font-bold uppercase">{jc.customer.regNo}</span>
                  </div>
                  <div>
                    <label className="text-[9.5px] text-muted-foreground block mb-0.5 uppercase">Chassis No / VIN</label>
                    <p className="text-[11.5px] font-mono text-white mt-0.5">{jc.customer.vin}</p>
                  </div>
                  <div>
                    <label className="text-[9.5px] text-muted-foreground block mb-0.5 uppercase font-bold text-primary">Mobile Number 1 *</label>
                    <input 
                      value={mobile1}
                      onChange={(e) => setMobile1(e.target.value)}
                      className="w-full mt-0.5 bg-card/60 border border-border focus:border-primary rounded px-2.5 py-1 text-[12px] font-mono outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[9.5px] text-muted-foreground block mb-0.5 uppercase font-light">Mobile Number 2</label>
                    <input 
                      value={mobile2}
                      onChange={(e) => setMobile2(e.target.value)}
                      placeholder="Optional"
                      className="w-full mt-0.5 bg-card/60 border border-border focus:border-primary rounded px-2.5 py-1 text-[12px] font-mono outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[9.5px] text-muted-foreground block mb-0.5 uppercase font-bold text-primary">Email Address *</label>
                    <input 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full mt-0.5 bg-card/60 border border-border focus:border-primary rounded px-2.5 py-1 text-[12px] outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Readonly technical status box */}
              <div className="bg-card/30 p-4 rounded-xl border border-border grid grid-cols-2 sm:grid-cols-5 gap-4 text-[11px]">
                <div>
                  <span className="text-[8.5px] block text-muted-foreground uppercase">Service Category</span>
                  <strong className="text-white uppercase">{jc.serviceType}</strong>
                </div>
                <div>
                  <span className="text-[8.5px] block text-muted-foreground uppercase">Appointment Type</span>
                  <strong className="text-primary">DMS Walk-In</strong>
                </div>
                <div>
                  <span className="text-[8.5px] block text-muted-foreground uppercase">EW Type Status</span>
                  <strong className="text-[#4ADE80]">EW Purchased</strong>
                </div>
                <div>
                  <span className="text-[8.5px] block text-muted-foreground uppercase">Technical Campaign</span>
                  <strong className="text-yellow-400">01 Active (S-CNG Bolt Check)</strong>
                </div>
                <div>
                  <span className="text-[8.5px] block text-muted-foreground uppercase">Previous Service Visit</span>
                  <strong className="text-white">Completed (18-MAY-2026)</strong>
                </div>
              </div>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4">
              <h3 className="text-[15px] font-bold font-sans text-primary uppercase tracking-wide border-b border-border pb-1">JOBCARD DETAILS</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* Card 1: Bay Details */}
                <div className="bg-card border border-border p-4 rounded-xl flex flex-col gap-3">
                  <p className="text-[11.5px] font-bold font-sans text-secondary uppercase border-b border-border pb-1">Bay Details</p>
                  <div>
                    <label className="text-[9.5px] text-muted-foreground block mb-0.5">BAY CODE *</label>
                    <select value={bay} onChange={(e) => setBay(e.target.value)} className="w-full bg-card text-white text-[11.5px] px-2 py-1.5 rounded border border-border outline-none font-bold">
                      <option value="">Select Bay</option>
                      <option value="BODY REPAIRS">BODY REPAIRS</option>
                      <option value="BAY-01">BAY-01 (PMS STANDARD)</option>
                      <option value="BAY-02">BAY-02 (RUNNING REPAIR)</option>
                      <option value="BAY-03">BAY-03 (ALIGMENTS/WHEELS)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[9.5px] text-muted-foreground block mb-0.5">GROUP CODE *</label>
                    <select value={group} onChange={(e) => setGroup(e.target.value)} className="w-full bg-card text-white text-[11.5px] px-2 py-1.5 rounded border border-border outline-none">
                      <option value="Other Group 2">Other Group 2</option>
                      <option value="GRP-A">GROUP-A (PMS/BODY)</option>
                      <option value="GRP-B">GROUP-B (CAR WASHING)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[9.5px] text-muted-foreground block mb-0.5">TECHNICIAN *</label>
                    <select value={technician} onChange={(e) => setTechnician(e.target.value)} className="w-full bg-card text-white text-[11.5px] px-2 py-1.5 rounded border border-border outline-none font-bold">
                      <option value="">Select Technician</option>
                      <option value="Technician 3">Technician 3 (Sandeep S)</option>
                      <option value="RAJESH KUMAR">RAJESH KUMAR</option>
                      <option value="VISHAL ADITYA">VISHAL ADITYA</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[9.5px] text-muted-foreground block mb-0.5">TECHNICAL EXPERT</label>
                    <select value={techExpert} onChange={(e) => setTechExpert(e.target.value)} className="w-full bg-card text-white text-[11.5px] px-2 py-1.5 rounded border border-border outline-none">
                      <option value="Expert 2">Technical Expert 2</option>
                      <option value="Expert 1">Technical Advisor/Trainer</option>
                    </select>
                  </div>
                </div>

                {/* Card 2: Last Follow-up details */}
                <div className="bg-card border border-border p-4 rounded-xl flex flex-col gap-3">
                  <p className="text-[11.5px] font-bold font-sans text-secondary uppercase border-b border-border pb-1 font-semibold">Last Follow-Up Details</p>
                  <div>
                    <label className="text-[9.5px] text-muted-foreground block mb-0.5">FOLLOW UP DATE</label>
                    <input type="text" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} className="w-full bg-card text-white text-[11.5px] px-2 py-1.5 rounded border border-border outline-none font-mono" />
                  </div>
                  <div>
                    <label className="text-[9.5px] text-muted-foreground block mb-0.5">CS% VALUE</label>
                    <input type="text" value={csPercent} onChange={(e) => setCsPercent(e.target.value)} className="w-full bg-card text-white text-[11.5px] px-2 py-1.5 rounded border border-border outline-none font-mono" />
                  </div>
                  <div>
                    <label className="text-[9.5px] text-muted-foreground block mb-0.5">FOLLOW UP DONE BY</label>
                    <select value={followUpDoneBy} onChange={(e) => setFollowUpDoneBy(e.target.value)} className="w-full bg-card text-white text-[11.5px] px-2 py-1.5 rounded border border-border outline-none">
                      <option value="CEO">CEO (Customer Experience Officer)</option>
                      <option value="Advisor CRM">Advisor CRM Team</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[9.5px] text-muted-foreground block mb-0.5">CEO APPROVAL STATUS</label>
                    <input type="text" readOnly value={ceoApprovalStatus} className="w-full bg-background text-muted-foreground text-[11px] px-2.5 py-1.5 rounded border border-border outline-none font-mono" />
                  </div>
                </div>

                {/* Card 3: Road Test Details */}
                <div className="bg-card border border-border p-4 rounded-xl flex flex-col gap-3">
                  <p className="text-[11.5px] font-bold font-sans text-secondary uppercase border-b border-border pb-1">Road Test Details</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[9px] text-muted-foreground block mb-0.5">START TIME</label>
                      <input type="text" value={roadTestStartTime} onChange={(e) => setRoadTestStartTime(e.target.value)} className="w-full bg-card text-[11.5px] p-1.5 rounded border border-border text-center font-mono" />
                    </div>
                    <div>
                      <label className="text-[9px] text-muted-foreground block mb-0.5">START KMS</label>
                      <input type="text" value={roadTestStartKms} onChange={(e) => setRoadTestStartKms(e.target.value)} className="w-full bg-card text-[11.5px] p-1.5 rounded border border-border text-center font-mono font-bold" />
                    </div>
                    <div>
                      <label className="text-[9px] text-muted-foreground block mb-0.5">END TIME</label>
                      <input type="text" value={roadTestEndTime} onChange={(e) => setRoadTestEndTime(e.target.value)} className="w-full bg-card text-[11.5px] p-1.5 rounded border border-border text-center font-mono" />
                    </div>
                    <div>
                      <label className="text-[9px] text-muted-foreground block mb-0.5">END KMS</label>
                      <input type="text" value={roadTestEndKms} onChange={(e) => setRoadTestEndKms(e.target.value)} className="w-full bg-card text-[11.5px] p-1.5 rounded border border-border text-center font-mono font-bold" />
                    </div>
                  </div>
                  <p className="text-[9.5px] text-muted-foreground italic mt-1 leading-snug">Road test validates wheel alignment and brake efficiency. Ensure values are locked into DMS.</p>
                </div>

              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4">
              <h3 className="text-[15px] font-bold font-sans text-primary uppercase tracking-wide border-b border-border pb-1">VEHICLE STATUS (INSPECTION & RECORDING)</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                
                {/* Left Panel: Car Interactive Hotspots */}
                <div className="bg-card border border-border p-4 rounded-xl flex flex-col gap-3">
                  <div className="flex justify-between items-center">
                    <p className="text-[12.5px] font-bold font-sans text-secondary uppercase font-semibold">Overhead Damage Diagram</p>
                    <div className="flex gap-1">
                      <button onClick={() => { setScratchDot([3, 7]); setDentDot([1, 10]); }} className="text-[9.5px] bg-card border border-border hover:border-white px-2 py-0.5 rounded font-bold transition-all">RESET</button>
                    </div>
                  </div>

                  {/* SVG Top View Car Diagram with 14 spots */}
                  <div className="relative border border-border rounded-xl bg-black p-4 select-none">
                    <div className="absolute top-2 left-2 text-[9px] text-muted-foreground">TOP VIEW CAR OVERLAY</div>
                    
                    <svg viewBox="0 0 400 160" className="w-full h-[120px] filter drop-shadow(0 0 10px rgba(61,142,240,0.06))">
                      {/* Detailed vector car silhouette drawing */}
                      <rect x="60" y="40" width="280" height="80" rx="36" fill="#142035" stroke="#3D8EF0" strokeWidth="2.5" />
                      <path d="M120 40 C140 10, 260 10, 280 40 Z" fill="#0A1020" stroke="#3D8EF0" strokeWidth="1.5" />
                      <line x1="120" y1="40" x2="280" y2="40" stroke="#3D8EF0" strokeWidth="2" />
                      <line x1="120" y1="120" x2="280" y2="120" stroke="#3D8EF0" strokeWidth="2" />
                      <rect x="90" y="55" width="220" height="50" rx="15" fill="#070C16" stroke="#253347" strokeWidth="1" />
                      
                      {/* 14 hotspots dots */}
                      {Array.from({ length: 14 }).map((_, i) => {
                        const hNo = i + 1;
                        const rx = 80 + i * 19;
                        const ry = 48 + (i % 3) * 32;

                        const isScratch = scratchDot.includes(hNo);
                        const isDent = dentDot.includes(hNo);

                        let color = "bg-[#455A64]/60";
                        let label = String(hNo);
                        if (isScratch) { color = "bg-amber-500 shadow-[0_0_8px_#F59E0B]"; label = "S"; }
                        if (isDent) { color = "bg-red-500 shadow-[0_0_8px_#EF4444]"; label = "D"; }

                        return (
                          <foreignObject key={hNo} x={rx - 7} y={ry - 7} width="16" height="16">
                            <button 
                              onClick={() => {
                                if (isScratch) {
                                  // toggle to dent
                                  setScratchDot(scratchDot.filter(x => x !== hNo));
                                  setDentDot([...dentDot, hNo]);
                                } else if (isDent) {
                                  // toggle standard clean
                                  setDentDot(dentDot.filter(x => x !== hNo));
                                } else {
                                  // toggle to scratch
                                  setScratchDot([...scratchDot, hNo]);
                                }
                              }}
                              className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold text-white transition-all cursor-pointer ${color}`}
                              title={`Hotspot ${hNo}`}
                            >
                              {label}
                            </button>
                          </foreignObject>
                        );
                      })}
                    </svg>
                  </div>
                  
                  <div className="flex gap-4 justify-between text-[11px] bg-card/30 p-2.5 rounded-lg border border-border font-bold tracking-tight select-none">
                    <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Scratches: <strong className="text-amber-400 font-mono">{scratchDot.length}</strong></span>
                    <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-red-400" /> Dents: <strong className="text-red-400 font-mono">{dentDot.length}</strong></span>
                    <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded bg-blue-500" /> Total Elements: <strong className="font-mono">{scratchDot.length + dentDot.length}</strong></span>
                  </div>

                  <div className="border-t border-border/40 pt-3 mt-1 flex flex-col gap-2.5">
                    <p className="text-[11px] font-black text-foreground uppercase tracking-wider flex items-center gap-1.5 font-sans">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
                      AI Walkaround & Body Scanner
                    </p>

                    <AnimatePresence>
                      {showLiveScanner && (
                        <motion.div 
                          initial={{ opacity: 0 }} 
                          animate={{ opacity: 1 }} 
                          exit={{ opacity: 0 }}
                          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
                        >
                          <VehicleScanner 
                            onClose={() => setShowLiveScanner(false)}
                            onScan={(images) => {
                              setShowLiveScanner(false);
                              // Trigger auto analysis simulation after capture
                              setVideoAnalyzing(true);
                              setVideoPlayProgress(0);
                              const timer = setInterval(() => {
                                setVideoPlayProgress((prev) => {
                                  if (prev >= 100) {
                                    clearInterval(timer);
                                    setScratchDot([1, 4, 8, 3, 7, 11]);
                                    setDentDot([2, 5, 9, 13]);
                                    return 100;
                                  }
                                  return prev + 10;
                                });
                              }, 130);
                            }}
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {!videoAnalyzing && videoPlayProgress === 0 ? (
                      <div className="grid grid-cols-3 gap-2">
                        <label className="flex flex-col items-center justify-center gap-1.5 p-2 rounded-xl border border-border bg-card/60 hover:bg-muted hover:border-primary/30 transition-all cursor-pointer text-center select-none active:scale-95">
                          <input 
                            type="file" 
                            accept="video/*" 
                            className="hidden" 
                            onChange={(e) => {
                              if (e.target.files && e.target.files[0]) {
                                setVideoAnalyzing(true);
                                setVideoPlayProgress(0);
                                const timer = setInterval(() => {
                                  setVideoPlayProgress((prev) => {
                                    if (prev >= 100) {
                                      clearInterval(timer);
                                      setScratchDot([1, 4, 8, 3, 7]);
                                      setDentDot([2, 5, 10]);
                                      return 100;
                                    }
                                    return prev + 10;
                                  });
                                }, 130);
                              }
                            }} 
                          />
                          <Upload size={14} className="text-secondary" />
                          <span className="text-[9px] font-black uppercase text-foreground leading-tight">Upload Video</span>
                        </label>
                        
                        <button
                          type="button"
                          onClick={() => setShowLiveScanner(true)}
                          className="flex flex-col items-center justify-center gap-1.5 p-2 rounded-xl border border-border bg-card/60 hover:bg-muted hover:border-primary/30 transition-all cursor-pointer text-center select-none active:scale-95"
                        >
                          <Camera size={14} className="text-primary" />
                          <span className="text-[9px] font-black uppercase text-foreground leading-tight">Live Scan</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setVideoPlayProgress(100);
                            setScratchDot([1, 4, 8, 3, 7]);
                            setDentDot([2, 5, 10]);
                          }}
                          className="flex flex-col items-center justify-center gap-1.5 p-2 rounded-xl border border-border bg-card/60 hover:bg-muted hover:border-primary/30 transition-all cursor-pointer text-center select-none active:scale-95"
                        >
                          <ClipboardList size={14} className="text-muted-foreground" />
                          <span className="text-[9px] font-black uppercase text-foreground leading-tight">Autofill</span>
                        </button>
                      </div>
                    ) : videoAnalyzing && videoPlayProgress < 100 ? (
                      <div className="p-3 rounded-xl bg-background border border-border text-center flex flex-col items-center gap-2">
                        <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                        <p className="text-[11px] font-bold text-foreground">Analyzing walkaround recording...</p>
                        <div className="w-full bg-card h-1.5 rounded-full overflow-hidden">
                          <div className="bg-primary h-full transition-all duration-150" style={{ width: `${videoPlayProgress}%` }} />
                        </div>
                        <p className="text-[8.5px] font-mono text-muted-foreground">{videoPlayProgress}% Keyframes analyzed</p>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <div className="bg-[#4ADE80]/15 border border-[#4ADE80]/20 p-2.5 rounded-xl flex items-start gap-2 text-left">
                          <CheckCircle size={14} className="text-[#4ADE80] shrink-0 mt-0.5" />
                          <div className="text-[11px] leading-tight">
                            <p className="text-[#4ADE80] font-black uppercase tracking-wider text-[9px]">AI Scanner Complete</p>
                            <p className="text-muted-foreground mt-0.5">Identified & loaded {scratchDot.length + dentDot.length} damage hotspots above 85% confidence.</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setVideoAnalyzing(false);
                            setVideoPlayProgress(0);
                            setScratchDot([1, 4, 8]);
                            setDentDot([2, 5]);
                          }}
                          className="text-[9px] text-muted-foreground hover:text-white transition-colors text-right underline cursor-pointer self-end"
                        >
                          Reset AI spots
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Panel: Side view + Image checklist */}
                <div className="bg-card border border-border p-4 rounded-xl flex flex-col gap-3">
                  <p className="text-[12.5px] font-bold font-sans text-secondary uppercase border-b border-border pb-1">Media Checklist & Fuel Gauge</p>
                  
                  {/* Photo logs count */}
                  <div className="flex flex-col gap-2 bg-card/30 p-3 rounded-lg border border-border">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-[11px] font-bold uppercase text-white">Interior Snaps Count: {interiorImagesCount}</p>
                        <p className="text-[9.5px] text-muted-foreground">Requires minimum 3 mandatory interior photos</p>
                      </div>
                      <div className="flex gap-1.5">
                        <button 
                          onClick={() => setInteriorImagesCount(Math.max(0, interiorImagesCount - 1))}
                          className="w-7 h-7 rounded bg-background border border-border flex items-center justify-center font-black select-none text-[14px]"
                        >
                          -
                        </button>
                        <button 
                          onClick={() => setInteriorImagesCount(interiorImagesCount + 1)}
                          className="w-7 h-7 rounded bg-background border border-border flex items-center justify-center font-black select-none text-[14px]"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    {interiorImagesCount >= 3 ? (
                      <span className="text-[10px] text-[#4ADE80] font-bold font-mono">✓ Mandatory checklist criteria fulfilled ({interiorImagesCount} snaps saved)</span>
                    ) : (
                      <span className="text-[10px] text-amber-400 font-bold font-mono">⚠️ Action Required: Add at least {3 - interiorImagesCount} more interior snaps</span>
                    )}
                  </div>

                  {/* Fuel gauge dropdown & meter */}
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-1 uppercase font-bold text-secondary">Fuel level status</label>
                    <div className="flex gap-3 items-center">
                      <select 
                        value={fuelLevel} 
                        onChange={(e) => setFuelLevel(e.target.value)}
                        className="bg-card text-white border border-border rounded px-2.5 py-1.5 text-[12px] font-bold outline-none cursor-pointer"
                      >
                        <option value="E">E (0%)</option>
                        <option value="1/4">1/4 (25%)</option>
                        <option value="1/2">1/2 (50%)</option>
                        <option value="3/4">3/4 (75%)</option>
                        <option value="F">F (100%)</option>
                      </select>
                      
                      {/* Visual fuel display meter */}
                      <div className="flex-1 h-3.5 bg-black/50 border border-border rounded overflow-hidden flex divide-x divide-black">
                        {Array.from({ length: 4 }).map((_, segmentIdx) => {
                          const levelsArr = ["E", "1/4", "1/2", "3/4", "F"];
                          let selectedIdx = levelsArr.indexOf(fuelLevel);
                          if (selectedIdx === -1) selectedIdx = 2; // default
                          const filled = segmentIdx < selectedIdx;
                          return (
                            <div 
                              key={segmentIdx} 
                              className={`h-full flex-1 transition-all duration-300 ${filled ? "bg-gradient-to-r from-primary to-accent" : "bg-card/10"}`} 
                            />
                          );
                        })}
                      </div>
                      <span className="text-[11px] font-mono text-primary font-bold pr-1">{fuelLevel === "E" ? "0%" : fuelLevel === "1/4" ? "25%" : fuelLevel === "1/2" ? "50%" : fuelLevel === "3/4" ? "75%" : "100%"}</span>
                    </div>
                  </div>

                  {/* Underbody and miscellaneous checkbox */}
                  <div className="flex items-center gap-2 mt-2">
                    <input 
                      type="checkbox" 
                      id="underbodyCheck" 
                      checked={underbodyCheck} 
                      onChange={(e) => setUnderbodyCheck(e.target.checked)}
                      className="w-4 h-4 rounded text-primary accent-primary outline-none cursor-pointer"
                    />
                    <label htmlFor="underbodyCheck" className="text-[12.5px] cursor-pointer select-none font-semibold text-white">FORMAL CAR UNDERBODY INSPECTION COMPLETED?</label>
                  </div>

                </div>

              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4">
              <h3 className="text-[15px] font-bold font-sans text-primary uppercase tracking-wide border-b border-border pb-1">SERVICE MENU DETAILS</h3>
              
              <div className="bg-card border border-border p-5 rounded-2xl flex flex-col gap-4 font-sans">
                <div className="border-b border-border pb-2">
                  <span className="text-[13px] font-bold font-sans text-secondary uppercase">Operational Closeout Matrix</span>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Please confirm payment configuration and technician checklist assignments.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-1 uppercase font-bold">Group Segment</label>
                    <p className="text-[12px] text-white font-bold bg-card/30 p-2.5 rounded border border-border font-mono">{group}</p>
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-1 uppercase font-bold">Closed By Expert</label>
                    <p className="text-[12px] text-white font-bold bg-card/30 p-2.5 rounded border border-border font-mono">{techExpert}</p>
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-1 uppercase font-bold">Primary Technician Assigned</label>
                    <p className="text-[12px] text-white font-bold bg-card/30 p-2.5 rounded border border-border font-mono">{technician}</p>
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-1 uppercase font-bold text-primary">Payment Mode *</label>
                    <select 
                      value={paymentMode} 
                      onChange={(e) => setPaymentMode(e.target.value)}
                      className="w-full bg-card text-white text-[12px] p-2 rounded border border-border outline-none font-bold cursor-pointer"
                    >
                      <option value="UPI">UPI / Digital Gateway</option>
                      <option value="Cash">Cash payment</option>
                      <option value="Card">Visa/National Card Swipe</option>
                      <option value="Insurance">Insurance Billed</option>
                      <option value="Warranty">Warranty covered</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-1 uppercase font-bold">Subtotal parts cost</label>
                    <p className="text-[12.5px] text-amber-400 font-bold bg-card/30 p-2 rounded border border-border font-mono">₹ {partsTotal.toLocaleString()}</p>
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-1 uppercase font-bold">Subtotal labour cost</label>
                    <p className="text-[12.5px] text-amber-400 font-bold bg-card/30 p-2 rounded border border-border font-mono font-bold">₹ {labourTotal.toLocaleString()}</p>
                  </div>
                </div>

                <div className="bg-primary/10 border border-primary/20 px-4 py-3 rounded-xl mt-2 flex justify-between items-center text-[13px]">
                  <span className="text-secondary tracking-wide uppercase font-sans font-bold">TOTAL ESTIMATE INVOICE AMOUNT (EXCLUDING SALES TAX):</span>
                  <strong className="text-primary font-mono text-[16px] font-black">₹ {grandTotal.toLocaleString()}</strong>
                </div>
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4">
              <div className="flex justify-between items-center border-b border-border pb-1">
                <h3 className="text-[15px] font-bold font-sans text-primary uppercase tracking-wide">DEMAND REPAIR DETAIL LIST</h3>
                <div className="flex gap-2 items-center text-[10px] text-muted-foreground font-semibold">
                  <span>Vehicle History</span> · <span>Email demands</span>
                </div>
              </div>

              {/* Table of repairs */}
              <div className="bg-card border border-border rounded-xl overflow-hidden font-sans">
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px] text-left">
                    <thead>
                      <tr className="bg-background border-b border-border text-[9px] uppercase font-sans text-muted-foreground">
                        <th className="p-3 w-12 text-center">S.No</th>
                        <th className="p-3">Demand Code</th>
                        <th className="p-3">Demand Desc</th>
                        <th className="p-3 text-center">Attended</th>
                        <th className="p-3 text-center">Carry Fwd</th>
                        <th className="p-3 text-center">EW/Wty</th>
                        <th className="p-3 text-center">Problem Code</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/15 font-sans">
                      {demands.map((dem, idx) => (
                        <tr key={idx} className="hover:bg-white/5 transition-colors">
                          <td className="p-3 font-mono text-center text-muted-foreground">{dem.sno}</td>
                          <td className="p-3 font-mono text-primary font-bold">{dem.code}</td>
                          <td className="p-3 text-foreground font-semibold uppercase">{dem.desc}</td>
                          <td className="p-3 text-center">
                            <input 
                              type="checkbox" 
                              checked={dem.attended} 
                              onChange={(e) => {
                                const newD = [...demands];
                                newD[idx].attended = e.target.checked;
                                setDemands(newD);
                              }}
                              className="accent-primary cursor-pointer w-3.5 h-3.5"
                            />
                          </td>
                          <td className="p-3 text-center">
                            <input 
                              type="checkbox" 
                              checked={dem.carry_forward} 
                              onChange={(e) => {
                                const newD = [...demands];
                                newD[idx].carry_forward = e.target.checked;
                                setDemands(newD);
                              }}
                              className="accent-primary cursor-pointer w-3.5 h-3.5"
                            />
                          </td>
                          <td className="p-3 text-center">
                            <input 
                              type="checkbox" 
                              checked={dem.ew_wty} 
                              onChange={(e) => {
                                const newD = [...demands];
                                newD[idx].ew_wty = e.target.checked;
                                setDemands(newD);
                              }}
                              className="accent-primary cursor-pointer w-3.5 h-3.5"
                            />
                          </td>
                          <td className="p-3 font-mono text-center text-white font-bold">{dem.problemCode}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Codes block */}
              <div className="bg-card border border-border p-4 rounded-xl flex flex-col gap-3 font-sans">
                <p className="text-[12px] font-bold font-sans text-secondary uppercase">Problem / Fault / Action Classification *</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="text-[9.5px] text-muted-foreground block mb-0.5 uppercase">Problem classification code *</label>
                    <input value={problemCode} onChange={(e) => setProblemCode(e.target.value)} className="w-full bg-card text-white text-[12px] p-2 rounded border border-border font-mono outline-none" />
                  </div>
                  <div>
                    <label className="text-[9.5px] text-muted-foreground block mb-0.5 uppercase">Fault code classification *</label>
                    <select value={faultCode} onChange={(e) => setFaultCode(e.target.value)} className="w-full bg-card text-white text-[12px] p-2 rounded border border-border outline-none">
                      <option value="FA09">FA09 (ELECTRICAL NOISE)</option>
                      <option value="FA12">FA12 (WHEEL ALIGNMENT OUT)</option>
                      <option value="FA15">FA15 (OIL DISCOLORATION)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[9.5px] text-muted-foreground block mb-0.5">ACTION CLASSIFICATION *</label>
                    <select value={actionCode} onChange={(e) => setActionCode(e.target.value)} className="w-full bg-card text-white text-[12px] p-2 rounded border border-border outline-none">
                      <option value="AC45">AC45 (REPLACE FILTER AND FLUID)</option>
                      <option value="AC12">AC12 (ADJUST AND RE-ALIGN)</option>
                      <option value="AC01">AC01 (WASH CLEANING)</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <div className="flex-1">
                    <label className="text-[9.5px] text-muted-foreground block mb-0.5 font-bold uppercase">SA Rework / Closing Remarks</label>
                    <textarea 
                      placeholder="Enter closing diagnostic remarks…" 
                      value={commentText} 
                      onChange={(e) => setCommentText(e.target.value)}
                      className="w-full bg-card text-white text-[11.5px] p-2 rounded border border-border outline-none h-14 resize-none"
                    />
                  </div>
                  
                  {/* Mock voice recorder button 🎙️ */}
                  <div className="w-full sm:w-48 bg-background border border-border p-3 rounded-xl flex flex-col justify-center items-center text-center select-none">
                    <p className="text-[9.5px] text-muted-foreground uppercase font-bold font-sans mb-1">🎙️ Voice Closing Memo</p>
                    <button 
                      onClick={() => {
                        if (recordVoiceActive) {
                          setRecordVoiceActive(false);
                        } else {
                          setRecordVoiceActive(true);
                          setVoiceSec(0);
                        }
                      }}
                      className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer ${recordVoiceActive ? "bg-red-500 animate-pulse border-2 border-white scale-110" : "bg-card hover:bg-white/5 border border-border"}`}
                    >
                      <Mic size={15} className={recordVoiceActive ? "text-white" : "text-muted-foreground"} />
                    </button>
                    <span className="text-[10px] font-mono text-[#4ADE80] font-bold mt-1.5">{recordVoiceActive ? `Recording... 00:${voiceSec < 10 ? '0' : ''}${voiceSec} s` : "Tap to record"}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {step === 5 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4 font-sans">
              <h3 className="text-[15px] font-bold font-sans text-primary uppercase tracking-wide border-b border-border pb-1">PART & LABOUR DETAILS</h3>
              
              {/* Tabs */}
              <div className="grid grid-cols-2 gap-2 bg-background p-1.5 rounded-xl border border-border text-center text-[12.5px] font-bold select-none font-sans uppercase tracking-wider">
                <button 
                  onClick={() => setShowAddLabour(false)} 
                  className={`py-2 rounded-lg transition-all ${!showAddLabour ? "bg-[#155DFC] text-white shadow-md shadow-[#155DFC]/20" : "text-muted-foreground hover:text-white"}`}
                >
                  Tab A — Labour Details
                </button>
                <button 
                  onClick={() => setShowAddLabour(true)} 
                  className={`py-2 rounded-lg transition-all ${showAddLabour ? "bg-[#155DFC] text-white shadow-md shadow-[#155DFC]/20" : "text-muted-foreground hover:text-white"}`}
                >
                  Tab B — Part Details
                </button>
              </div>

              {!showAddLabour ? (
                // Labour details tab
                <div className="flex flex-col gap-3 font-sans">
                  <div className="bg-card border border-border rounded-xl overflow-hidden text-[11px]">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-background text-muted-foreground text-[9.5px] font-bold font-sans uppercase tracking-wider border-b border-border">
                          <th className="p-3 w-12 text-center">S.No</th>
                          <th className="p-3">Labour Code</th>
                          <th className="p-3">Labour Description</th>
                          <th className="p-3 text-right">Price</th>
                          <th className="p-3">Billable Type</th>
                          <th className="p-3 text-center w-16">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/15 font-sans whitespace-nowrap">
                        {labourItems.map((item, idx) => (
                          <tr key={idx} className="hover:bg-white/5 transition-all">
                            <td className="p-3 text-center text-muted-foreground font-mono">{idx + 1}</td>
                            <td className="p-3 font-mono text-primary font-bold">{item.code}</td>
                            <td className="p-3 text-white font-semibold uppercase">{item.desc}</td>
                            <td className="p-3 text-right font-mono text-[#4ADE80] font-semibold">₹ {item.price.toLocaleString()}</td>
                            <td className="p-3 font-mono text-muted-foreground">{item.billableType}</td>
                            <td className="p-3 text-center">
                              <button 
                                onClick={() => setLabourItems(labourItems.filter((_, i) => i !== idx))}
                                className="text-red-400 hover:text-red-500 font-bold px-1 select-none text-[12.5px]"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex gap-2.5 justify-between items-center select-none flex-wrap">
                    <button 
                      onClick={() => {
                        // Quick add custom labour
                        setLabourItems([...labourItems, {
                          code: "ZA18LO",
                          desc: "Wheel Balancing & weight adjustment",
                          price: 490,
                          billableType: "Customer"
                        }]);
                      }}
                      className="px-4 py-2 bg-card hover:bg-white/5 border border-border rounded-lg text-[11.5px] font-bold uppercase tracking-wider font-sans flex items-center gap-1 cursor-pointer text-primary"
                    >
                      <Plus size={13} /> Add Labour Item
                    </button>

                    <div className="flex items-center gap-4 text-[11.5px] bg-card/30 p-2.5 rounded-lg border border-border">
                      <div>
                        <label className="text-[9.5px] text-muted-foreground uppercase block font-bold">Labour Discount %</label>
                        <select 
                          value={labourDiscPercent} 
                          onChange={(e) => setLabourDiscPercent(e.target.value)} 
                          className="bg-card text-white border border-border px-2 py-0.5 rounded outline-none font-mono font-bold font-semibold text-[11px]"
                        >
                          <option value="0">0% Discount</option>
                          <option value="5">5% Discount</option>
                          <option value="10">10% Discount</option>
                          <option value="20">20% Discount</option>
                        </select>
                      </div>
                      <div>
                        <span className="text-[9.5px] text-muted-foreground uppercase block font-bold">Authorised By *</span>
                        <select 
                          value={authBy} 
                          onChange={(e) => setAuthBy(e.target.value)} 
                          className="bg-card text-white border border-border px-2 py-0.5 rounded outline-none font-bold text-[11px]"
                        >
                          <option value="ASHWANI CHAUHAN">ASHWANI CHAUHAN (CRM)</option>
                          <option value="MANISH TIWARI">MANISH TIWARI (SA)</option>
                        </select>
                      </div>
                      <div className="font-sans font-bold border-l border-border pl-4">
                        <span className="text-muted-foreground font-light block uppercase text-[8.5px]">LABOUR SUM:</span>
                        <strong className="text-[#4ADE80] font-mono text-[13.5px]">₹ {labourTotal.toLocaleString()}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                // Part details tab
                <div className="flex flex-col gap-3 font-sans">
                  <div className="bg-card border border-border rounded-xl overflow-hidden text-[11px] font-sans">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-background text-muted-foreground text-[9.5px] font-bold font-sans uppercase tracking-wider border-b border-border">
                          <th className="p-3 w-12 text-center">S.No</th>
                          <th className="p-3">Part Name</th>
                          <th className="p-3 text-right">Price</th>
                          <th className="p-3 text-center">Qty</th>
                          <th className="p-3 text-right">Final Price</th>
                          <th className="p-3 text-center w-16">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/15 font-sans whitespace-nowrap">
                        {partsItems.map((item, idx) => (
                          <tr key={idx} className="hover:bg-white/5">
                            <td className="p-3 text-center text-muted-foreground font-mono">{idx + 1}</td>
                            <td className="p-3">
                              <p className="text-white font-semibold uppercase">{item.name}</p>
                              <p className="text-[9.5px] text-muted-foreground font-mono">{item.code}</p>
                            </td>
                            <td className="p-3 text-right font-mono">₹ {item.price.toLocaleString()}</td>
                            <td className="p-3 text-center font-mono">
                              <select 
                                value={item.qty} 
                                onChange={(e) => {
                                  const newP = [...partsItems];
                                  newP[idx].qty = Number(e.target.value);
                                  setPartsItems(newP);
                                }}
                                className="bg-card text-white border border-border rounded px-1 text-center text-[10.5px] font-bold outline-none"
                              >
                                {Array.from({ length: 5 }).map((_, i) => (
                                  <option key={i + 1} value={i + 1}>{i + 1}</option>
                                ))}
                              </select>
                            </td>
                            <td className="p-3 text-right font-mono text-[#4ADE80] font-semibold">₹ {(item.price * item.qty).toLocaleString()}</td>
                            <td className="p-3 text-center font-bold">
                              <button 
                                onClick={() => setPartsItems(partsItems.filter((_, i) => i !== idx))}
                                className="text-red-400 hover:text-red-500 font-bold px-1 select-none text-[12.5px]"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex justify-between items-center select-none mt-1">
                    <button 
                      onClick={() => {
                        // Quick add custom parts
                        setPartsItems([...partsItems, {
                          code: "99000M24120-11",
                          name: "Premium Nexa Car Cabin Sanitizer Liquid",
                          price: 285,
                          qty: 1
                        }]);
                      }}
                      className="px-4 py-2 bg-card hover:bg-white/5 border border-border rounded-lg text-[11.5px] font-bold uppercase tracking-wider font-sans flex items-center gap-1 cursor-pointer text-primary"
                    >
                      <Plus size={13} /> Add Parts Item
                    </button>
                    
                    <div className="text-right pr-2">
                      <span className="text-muted-foreground uppercase text-[9.5px] block font-bold font-light">PARTS SUM TOTAL:</span>
                      <strong className="text-[#4ADE80] font-mono text-[14px]">₹ {partsTotal.toLocaleString()}</strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Estimate overview strip */}
              <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-2 text-[12px] font-sans">
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Initial Estimations (Open Jc)</span>
                  <p className="text-white font-mono mt-0.5">₹ {jc.amount ? jc.amount.toLocaleString() : "4,200"}.00</p>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Revised Estimations (Closed Jc)</span>
                  <p className="text-[#4ADE80] font-black font-mono mt-0.5">₹ {grandTotal.toLocaleString()}.00</p>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Difference delta</span>
                  <p className={`font-black font-mono mt-0.5 ${grandTotal >= (jc.amount || 4200) ? "text-amber-400" : "text-emerald-400"}`}>
                    {grandTotal >= (jc.amount || 4200) ? "+" : "-"} ₹ {Math.abs(grandTotal - (jc.amount || 4200)).toLocaleString()}.00
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {step === 6 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4 font-sans">
              <h3 className="text-[15px] font-bold font-sans text-primary uppercase tracking-wide border-b border-border pb-1">LOYALTY POINTS & CCP ELIGIBILITY</h3>
              
              <div className="bg-card border border-border p-5 rounded-xl flex flex-col gap-4 max-w-md mx-auto w-full font-sans shadow-md">
                <div className="text-center pb-2 border-b border-border select-none">
                  <span className="text-[11.5px] bg-[#FACC15]/15 text-[#FACC15] border border-[#FACC15]/20 px-3 py-1 font-bold font-mono rounded-full text-[10.5px]">NEXA PLATINUM ELIGIBLE CUSTOMER</span>
                  <p className="text-[11px] text-muted-foreground mt-3 font-sans">Customer is eligible to redeem existing dealer CCP loyalty cash credits instantly.</p>
                </div>

                <div className="grid grid-cols-2 gap-3.5 text-[11.5px]">
                  <div>
                    <label className="text-[9px] text-muted-foreground uppercase font-bold">CCP Tier Style</label>
                    <p className="text-white font-bold font-sans text-[13px] uppercase">👑 Nexa Gold Tier</p>
                  </div>
                  <div>
                    <label className="text-[9px] text-muted-foreground uppercase font-bold">Loyalty Card Register</label>
                    <p className="text-white font-mono font-bold">{ccpCard}</p>
                  </div>
                  <div>
                    <label className="text-[9px] text-muted-foreground uppercase font-bold">Registered Mobile</label>
                    <p className="text-white font-mono">{ccpMobile}</p>
                  </div>
                  <div>
                    <label className="text-[9px] text-muted-foreground uppercase font-bold col-span-1">Valid Loyalty Points</label>
                    <p className="text-[#FACC15] font-mono font-bold text-[13px]">{ccpPoints} Points (Value: ₹ 542)</p>
                  </div>
                </div>

                {!otpConfirmed ? (
                  <div className="bg-background p-4 rounded-xl border border-border flex flex-col gap-3.5 shrink-0 select-none">
                    <p className="text-[11.5px] font-bold text-white uppercase tracking-tight">Verify Secure CCP Redemption Code</p>
                    <div className="flex gap-2">
                      <input 
                        type="number" 
                        value={ccpRedeemVal} 
                        onChange={(e) => setCcpRedeemVal(e.target.value)}
                        placeholder="Points count (max 542)"
                        className="bg-card text-white border border-border rounded px-2 text-[12px] w-2/3 outline-none"
                      />
                      <button 
                        onClick={() => {
                          setOtpSent(true);
                          triggerToast("Secure verification OTP text sent successfully to " + ccpMobile);
                          setCcpOtpVal("8022"); // default mock otp code
                        }}
                        className="flex-1 py-1.5 bg-primary hover:bg-primary-hover text-white text-[11px] font-bold uppercase tracking-wider rounded transition-all font-sans"
                      >
                        {otpSent ? "SEND RE-OTP" : "SEND OTP"}
                      </button>
                    </div>

                    {otpSent && (
                      <div className="flex items-center gap-2 animate-fade-in border-t border-border pt-2.5 mt-1 shrink-0">
                        <input 
                          type="text" 
                          placeholder="Enter 4-digit code" 
                          value={otpCode}
                          onChange={(e) => setOtpCode(e.target.value)}
                          className="bg-card text-white text-[12px] p-1.5 rounded border border-border text-center font-mono w-1/2 outline-none font-bold"
                        />
                        <button 
                          onClick={() => {
                            if (otpCode === "8022" || otpCode.trim().length > 2) {
                              setOtpConfirmed(true);
                              triggerToast("Loyalty Points verified & applied to cart! ₹" + ccpRedeemVal + " discount implemented.");
                            } else {
                              triggerToast("Invalid OTP code! Please use mock code 8022 to proceed.");
                            }
                          }}
                          className="flex-1 py-1.5 bg-[#10B981] hover:bg-[#10B981]/90 text-white text-[11px] font-bold uppercase rounded font-sans"
                        >
                          CONFIRM OTP
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-[#10B981]/10 border border-[#10B981]/35 p-4 rounded-xl text-center select-none font-sans font-bold">
                    <p className="text-[#10B981] text-[13px] uppercase">✓ OTP verified Successfully!</p>
                    <p className="text-[11.5px] mt-1 text-white">Applied Loyalty Discount: <span className="text-[#10B981] font-mono">₹ {ccpRedeemVal || 0}</span></p>
                  </div>
                )}

                <div className="flex justify-center select-none">
                  <button 
                    onClick={() => {
                      setOtpConfirmed(false);
                      setOtpSent(false);
                      setCcpRedeemVal("");
                      setStep(7); // Skip loyalty
                    }} 
                    className="text-[11.5px] font-bold text-muted-foreground hover:text-white uppercase transition-colors"
                  >
                    Skip loyalty / Skip CCP verify ↩
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {step === 7 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4 font-sans">
              <h3 className="text-[15px] font-bold font-sans text-primary uppercase tracking-wide border-b border-border pb-1">PICK UP & DROP DETAILS</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Pick up Details Card */}
                <div className="bg-card border border-border p-4 rounded-xl flex flex-col gap-3 font-sans">
                  <div className="flex justify-between items-center border-b border-border pb-1">
                    <p className="text-[12px] font-bold font-sans text-secondary uppercase">Pick Up Metrics</p>
                    <span className="text-[9.5px] text-muted-foreground uppercase cursor-pointer hover:text-white" onClick={() => setPickupRemarks("N/A")}>Reset</span>
                  </div>
                  <div>
                    <label className="text-[9.5px] text-muted-foreground block mb-0.5">PICK UP TYPE *</label>
                    <select value={pickupType} onChange={(e) => setPickupType(e.target.value)} className="w-full bg-card text-white text-[12px] p-2 rounded border border-border outline-none font-semibold">
                      <option value="2. Drop Only">2. Drop Only (Standard)</option>
                      <option value="1. Full PnD">1. Pick and Drop both</option>
                      <option value="MMS">MMS (Mobility Service)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[9.5px] text-muted-foreground block mb-0.5">PICK UP LOCATION</label>
                    <select value={pickupLoc} onChange={(e) => setPickupLoc(e.target.value)} className="w-full bg-card text-white text-[12px] p-2 rounded border border-border outline-none">
                      <option value="Location 2">Gurgaon Sector 2</option>
                      <option value="Location 1">Gurgaon Sector 14</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[9.5px] text-muted-foreground block mb-0.5">PICK UP ADDRESS</label>
                    <input value={pickupAddr} onChange={(e) => setPickupAddr(e.target.value)} className="w-full bg-card text-white text-[12px] p-2 rounded border border-border outline-none" />
                  </div>
                  <div>
                    <label className="text-[9.5px] text-muted-foreground block mb-0.5">ASSOCIATED DRIVER</label>
                    <select value={pndAssociate} onChange={(e) => setPndAssociate(e.target.value)} className="w-full bg-card text-white text-[12px] p-2 rounded border border-border outline-none">
                      <option value="Associate 2">Associate Driver 2</option>
                      <option value="Associate 1">Associate Driver 1 (Ramesh)</option>
                    </select>
                  </div>
                </div>

                {/* Drop Details Card */}
                <div className="bg-card border border-border p-4 rounded-xl flex flex-col gap-3">
                  <div className="flex justify-between items-center border-b border-border pb-1">
                    <p className="text-[12px] font-bold font-sans text-secondary uppercase font-semibold">Drop Out Details</p>
                    <div className="flex items-center gap-1.5 select-none">
                      <input 
                        type="checkbox" 
                        id="sameAsPickup" 
                        checked={sameAsPickup} 
                        onChange={(e) => {
                          setSameAsPickup(e.target.checked);
                          if (e.target.checked) {
                            setDropLoc(pickupLoc);
                            setDropAddr(pickupAddr);
                          }
                        }}
                        className="accent-primary cursor-pointer w-3 h-3"
                      />
                      <label htmlFor="sameAsPickup" className="text-[10px] text-white cursor-pointer font-bold">Same as Pick Up?</label>
                    </div>
                  </div>
                  <div>
                    <label className="text-[9.5px] text-muted-foreground block mb-0.5">DROP TIME & TARGET DATE</label>
                    <input value={dropTimeDate} onChange={(e) => setDropTimeDate(e.target.value)} className="w-full bg-card text-white text-[12px] p-2 rounded border border-border outline-none font-mono" />
                  </div>
                  <div>
                    <label className="text-[9.5px] text-muted-foreground block mb-0.5">DROP LOCATION</label>
                    <select value={dropLoc} onChange={(e) => setDropLoc(e.target.value)} className="w-full bg-card text-white text-[12px] p-2 rounded border border-border outline-none">
                      <option value="Location 2">Gurgaon Sector 2</option>
                      <option value="Location 1">Gurgaon Sector 14</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[9.5px] text-muted-foreground block mb-0.5">DROP ARRIVAL ADDRESS</label>
                    <input value={dropAddr} onChange={(e) => setDropAddr(e.target.value)} className="w-full bg-card text-white text-[12px] p-2 rounded border border-border outline-none" />
                  </div>
                  <div>
                    <label className="text-[9.5px] text-muted-foreground block mb-0.5">DROP ASSOCIATED DRIVER</label>
                    <select value={dropAssociate} onChange={(e) => setDropAssociate(e.target.value)} className="w-full bg-card text-white text-[12px] p-2 rounded border border-border outline-none">
                      <option value="Associate 2">Associate Driver 2</option>
                      <option value="Associate 1">Associate Driver 1</option>
                    </select>
                  </div>
                </div>

              </div>
            </motion.div>
          )}

          {step === 8 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4 font-sans max-w-lg mx-auto w-full">
              <h3 className="text-[15px] font-bold font-sans text-primary uppercase tracking-wide border-b border-border pb-1">TCS DETAILS & FISCAL POLICY</h3>
              
              <div className="bg-card border border-border p-5 rounded-xl flex flex-col gap-3 font-sans shadow-md">
                <p className="text-[9.5px] text-muted-foreground leading-relaxed font-semibold uppercase text-secondary">TCS section 206C(1H) @ 0.1% audit declaration details</p>
                <div className="bg-black/40 text-[10px] text-muted-foreground p-3 rounded border border-border leading-relaxed font-mono">
                  TCS under section 206C(1H) @0.1% is applicable on receipt of consideration for sale of any goods. The aggregate of TDS and TCS for any of the two immediately preceding FY is checked before invoicing.
                </div>

                <div className="flex flex-col gap-2.5 pt-1 text-[11.5px] select-none">
                  <div className="flex justify-between items-center bg-card/30 p-2 rounded border border-border">
                    <span>Tax TCS on Customer ?</span>
                    <select value={tcsCust} onChange={(e) => setTcsCust(e.target.value)} className="bg-background text-[#4ADE80] border border-border rounded px-2.5 py-1 text-[11px] font-bold outline-none cursor-pointer">
                      <option value="NO">NO TCS</option>
                      <option value="YES">YES APPLICABLE (@0.1%)</option>
                    </select>
                  </div>
                  <div className="flex justify-between items-center bg-card/30 p-2 rounded border border-border">
                    <span>Tax TCS on Insurance portion ?</span>
                    <select value={tcsIns} onChange={(e) => setTcsIns(e.target.value)} className="bg-background text-[#4ADE80] border border-border rounded px-2.5 py-1 text-[11px] font-bold outline-none cursor-pointer">
                      <option value="NO">NO TCS</option>
                      <option value="YES">YES APPLICABLE (@0.1%)</option>
                    </select>
                  </div>
                  <div className="flex justify-between items-center bg-card/30 p-2 rounded border border-border">
                    <span>Tax TCS on EWR / TWN parameters ?</span>
                    <select value={tcsEwrVal} onChange={(e) => setTcsEwrVal(e.target.value)} className="bg-background text-[#4ADE80] border border-border rounded px-2.5 py-1 text-[11px] font-bold outline-none cursor-pointer">
                      <option value="NO">NO TCS</option>
                      <option value="YES">YES APPLICABLE (@0.1%)</option>
                    </select>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {step === 9 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4 font-sans">
              <h3 className="text-[15px] font-bold font-sans text-primary uppercase tracking-wide border-b border-border pb-1">Pre-Invoice Bill Summary</h3>
              
              <div className="bg-card border border-border p-5 rounded-2xl flex flex-col gap-4 text-[12px] font-sans">
                <div className="flex justify-between items-center border-b border-border pb-2 select-none">
                  <div>
                    <h4 className="text-[13.5px] font-bold font-sans text-secondary uppercase">Pre-Invoice Summary Billed Summary</h4>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Locked Date: 25-MAY-2026, 03:58 PM</p>
                  </div>
                  <span className="text-[11px] text-[#4ADE80] font-mono bg-[#10B981]/15 px-2.5 py-1 rounded border border-[#10B981]/30">PRE-CALCULATIONS APPROVED</span>
                </div>

                {/* Grid list details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Labour cost panel */}
                  <div className="border border-border rounded-xl bg-black/30 p-3.5">
                    <p className="text-[10.5px] font-bold uppercase tracking-wider text-primary mb-2 font-sans">Billed Labour Items</p>
                    <div className="flex flex-col gap-1.5 font-sans divide-y divide-border/5">
                      {labourItems.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center pt-1.5 text-[11px]">
                          <span className="text-muted-foreground truncate uppercase pr-2 max-w-[190px]">{item.desc}</span>
                          <span className="font-mono text-white">₹ {item.price.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Parts billing panel */}
                  <div className="border border-border rounded-xl bg-black/30 p-3.5 font-sans">
                    <p className="text-[10.5px] font-bold uppercase tracking-wider text-accent mb-2 font-sans">Billed Parts Spares</p>
                    <div className="flex flex-col gap-1.5 divide-y divide-border/5">
                      {partsItems.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center pt-1.5 text-[11px]">
                          <span className="text-muted-foreground truncate uppercase pr-2 max-w-[180px]">{item.name} (x{item.qty})</span>
                          <span className="font-mono text-white">₹ {(item.price * item.qty).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Summary block */}
                <div className="bg-background border border-border p-4 rounded-xl flex flex-col gap-1.5 font-sans mt-1">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Total Parts Cost Spares portion:</span>
                    <span className="font-mono text-white">₹ {partsTotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Total Labour Operations portion:</span>
                    <span className="font-mono text-white">₹ {labourTotal.toLocaleString()}</span>
                  </div>
                  {otpConfirmed && (
                    <div className="flex justify-between items-center text-amber-400">
                      <span>Applied Dealer CCP Loyalty Points:</span>
                      <span className="font-mono">- ₹ {ccpRedeemVal}</span>
                    </div>
                  )}
                  <div className="border-t border-border my-2 pt-2 flex justify-between items-center text-[14px] font-bold">
                    <span className="text-primary font-sans uppercase tracking-wider">Estimated Gross Total (Tax exclusive):</span>
                    <strong className="text-primary font-mono select-all">₹ {grandTotal.toLocaleString()}.00</strong>
                  </div>
                </div>

                {/* Extra simulated actions */}
                <div className="flex gap-2 flex-wrap pt-1 shrink-0 select-none justify-center">
                  <button 
                    onClick={() => {
                      setIsPreinvoicePdfSimulated(true);
                      triggerToast("PDF generated and downloaded successfully inside browser sandbox!");
                    }} 
                    className="py-1.5 px-4 bg-card/70 hover:bg-card text-white rounded border border-border text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors font-sans"
                  >
                    <Eye size={12} /> {isPreinvoicePdfSimulated ? "Re-preview PDF" : "Preview Invoice"}
                  </button>
                  <button 
                    onClick={() => {
                      triggerToast("Sent PDF print job successfully to workshop floor printer #4.");
                    }} 
                    className="py-1.5 px-4 bg-card/70 hover:bg-card text-white rounded border border-border text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors font-sans"
                  >
                    <Printer size={12} /> Print Draft
                  </button>
                  <button 
                    onClick={() => {
                      setIsPreinvoiceEmailed(true);
                      triggerToast("Preinvoice summary successfully emailed to " + email);
                    }} 
                    className="py-1.5 px-4 bg-card/70 hover:bg-card text-[#10B981] hover:text-[#10B981] border border-[#10B981]/30 rounded text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors font-sans"
                  >
                    <Mail size={12} /> {isPreinvoiceEmailed ? "Re-email Invoice Draft" : "Email Draft"}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

        </div>
      </div>

      {/* Button navigation floor bar */}
      <div className="bg-background border-t border-border px-6 py-4 flex items-center justify-between shrink-0 select-none text-[12px] font-bold">
        <button 
          onClick={handlePrevStep}
          className="flex items-center gap-1 px-4 py-2 bg-card hover:bg-white/5 border border-border rounded-lg text-muted-foreground hover:text-white transition-all font-sans uppercase tracking-wider font-bold"
        >
          {step === 0 ? "✖ Cancel and exit" : "↩ Previous step"}
        </button>

        {step === 7 ? (
          <button 
            onClick={handleNextStep}
            className="flex items-center gap-1 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-lg transition-all font-sans uppercase tracking-wider font-extrabold shadow-lg shadow-primary/25"
          >
            📋 Generate Pre-Invoice
          </button>
        ) : step === 9 ? (
          <button 
            onClick={() => {
              setShowSuccessCard(true);
            }}
            className="flex items-center gap-1 px-6 py-2.5 bg-[#10B981] hover:bg-[#10B981]/90 text-white rounded-lg transition-all font-sans uppercase tracking-widest font-black shadow-lg shadow-[#10B981]/15"
          >
            ✅ CLOSE JOBCARD & DMS GENERATE
          </button>
        ) : (
          <button 
            onClick={handleNextStep}
            className="flex items-center gap-1 px-5 py-2.5 bg-primary hover:bg-primary/95 text-white rounded-lg transition-all font-sans uppercase tracking-wider font-bold"
          >
            Next step ({stepsLabels[step + 1] || "Finish"}) →
          </button>
        )}
      </div>

    </div>
  )
}

// ── All Job Cards Panel ────────────────────────────────────────────────────────

function AllJobCardsPanel({ onAction }: { onAction?: (a: PanelType, d?: Record<string, unknown>) => void }) {
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("All")
  const [selectedJC, setSelectedJC] = useState<string | null>(null)
  const [tab1JcNo, setTab1JcNo] = useState<string | null>(null)
  const [jobs, setJobs] = useState<JobCard[]>(() => {
    try {
      const cached = localStorage.getItem("nexa_job_cards")
      return cached ? JSON.parse(cached) : JOB_CARDS
    } catch (e) {
      return JOB_CARDS
    }
  })

  useEffect(() => {
    localStorage.setItem("nexa_job_cards", JSON.stringify(jobs))
  }, [jobs])

  const filters = ["All", "In Progress", "OCAS Pending", "Pending", "Completed"]
  const filtered = jobs.filter(jc =>
    (filter === "All" || jc.status === filter) &&
    (jc.jcNo.toLowerCase().includes(search.toLowerCase()) ||
      jc.regNo.toLowerCase().includes(search.toLowerCase()) ||
      jc.model.toLowerCase().includes(search.toLowerCase()))
  )

  function handleStatusChange(jcNo: string, newStatus: string) {
    setJobs(prev => prev.map(j => j.jcNo === jcNo ? { ...j, status: newStatus as any } : j))
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        <div className="flex gap-2 items-center">
          <div className="relative flex-1">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search JC No, Reg, Model…"
              className="w-full pl-8 pr-3 py-2 text-[12px] bg-card border border-border rounded-lg text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 font-sans" />
          </div>
          <button
            onClick={() => onAction?.("jc-opening")}
            className="px-3.5 py-2 bg-primary hover:bg-primary/95 text-primary-foreground text-[11px] font-extrabold uppercase tracking-wide rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95 whitespace-nowrap"
            title="Create / Open New Job Card"
          >
             <Plus size={12} className="stroke-[3px]" />
             <span>New Job Card</span>
          </button>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {filters.map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1 text-[11px] font-semibold rounded-full transition-all font-sans ${filter === f ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"}`}>{f}</button>
          ))}
        </div>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-[11.5px]">
            <thead>
              <tr className="border-b border-border bg-card/60">
                {["JC Number", "Model", "Reg No", "Service Type", "Status", "Date", "Amount"].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left font-semibold text-muted-foreground font-sans text-[10px] tracking-wide uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(jc => (
                <tr key={jc.jcNo} className="border-b border-border hover:bg-card/30 cursor-pointer transition-colors group" onClick={() => setTab1JcNo(jc.jcNo)}>
                  <td className="px-3 py-2.5">
                    <button onClick={(e) => { e.stopPropagation(); setTab1JcNo(jc.jcNo); }}
                      className="text-primary font-mono font-medium hover:text-accent hover:underline underline-offset-2 transition-colors">
                      {jc.jcNo}
                    </button>
                  </td>
                  <td className="px-3 py-2.5 text-foreground max-w-[140px] truncate">{jc.model}</td>
                  <td className="px-3 py-2.5 text-foreground font-mono">{jc.regNo}</td>
                  <td className="px-3 py-2.5 text-foreground whitespace-nowrap">{jc.serviceType}</td>
                  <td className="px-3 py-2.5 relative" onClick={e => e.stopPropagation()}>
                    <select
                      value={jc.status}
                      onChange={e => handleStatusChange(jc.jcNo, e.target.value)}
                      className="appearance-none px-2 py-0.5 pr-6 rounded-full text-[10px] font-semibold whitespace-nowrap font-sans outline-none cursor-pointer"
                      style={{ background: "#1C2A3E", color: "#FFF" }}
                    >
                      {filters.filter(f => f !== "All").map(f => (
                        <option key={f} value={f} className="bg-card text-foreground">{f}</option>
                      ))}
                    </select>
                    <ChevronRight size={10} className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-50 rotate-90" />
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground font-mono">{jc.date}</td>
                  <td className="px-3 py-2.5 text-foreground font-mono">{jc.amount > 0 ? `₹${jc.amount.toLocaleString()}` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-muted-foreground font-mono">{filtered.length} job card{filtered.length !== 1 ? "s" : ""} shown · click a row or JC number to view TAB1 actions</p>
      </div>

      <AnimatePresence>
        {tab1JcNo && (
          <Tab1ActionModal 
            jcNo={tab1JcNo}
            onClose={() => setTab1JcNo(null)}
            onSelectAction={(action) => {
              if (action === "find_id" || action === "update") {
                setSelectedJC(tab1JcNo);
              } else if (action === "close") {
                const targetReg = jobs.find(j => j.jcNo === tab1JcNo)?.regNo || "HR26CW7677";
                onAction?.("close-jobcard", { jcNo: tab1JcNo, regNo: targetReg });
              }
              setTab1JcNo(null);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedJC && (
          <motion.div
            key={selectedJC}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <JCDetailModal jcNo={selectedJC} onClose={() => setSelectedJC(null)} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

// ── Tasks Panel ───────────────────────────────────────────────────────────────
function TasksPanel() {
  const [tasks, setTasks] = useState<Task[]>(() => {
    try {
      const cached = localStorage.getItem("nexa_tasks")
      return cached ? JSON.parse(cached) : TASKS_DATA
    } catch (e) {
      return TASKS_DATA
    }
  })

  useEffect(() => {
    localStorage.setItem("nexa_tasks", JSON.stringify(tasks))
  }, [tasks])
  const done = tasks.filter(t => t.done).length
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-card flex items-center justify-center">
            <span className="text-[13px] font-bold text-primary font-sans">{done}/{tasks.length}</span>
          </div>
          <div>
            <p className="text-[13px] font-semibold text-foreground font-sans">Tasks For Today</p>
            <p className="text-[11px] text-muted-foreground">21-May-2026 · {tasks.length - done} pending</p>
          </div>
        </div>
        <button className="flex items-center gap-1.5 text-primary text-[11px] font-semibold font-sans hover:text-accent">
          <Plus size={12} /> Add Task
        </button>
      </div>
      <div className="h-1.5 rounded-full bg-card overflow-hidden">
        <motion.div animate={{ width: `${(done / tasks.length) * 100}%` }} className="h-full rounded-full bg-gradient-to-r from-primary to-accent" />
      </div>
      <div className="flex flex-col gap-2">
        {tasks.map(task => (
          <div key={task.id} onClick={() => setTasks(ts => ts.map(t => t.id === task.id ? { ...t, done: !t.done } : t))}
            className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${task.done ? "border-border bg-card/50 opacity-60" : "border-border bg-card hover:border-primary/30"}`}>
            <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${task.done ? "border-[#4ADE80] bg-[#4ADE80]" : "border-muted-foreground"}`}>
              {task.done && <Check size={11} className="text-[#070C16]" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-[12px] font-sans font-semibold ${task.done ? "line-through text-muted-foreground" : "text-foreground"}`}>{task.text}</p>
              <div className="flex items-center gap-2 mt-1">
                <Clock size={10} className="text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground font-mono">{task.time}</span>
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold font-sans uppercase ${priorityColor(task.priority)}`}>{task.priority}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Notifications Panel ───────────────────────────────────────────────────────
function NotificationsPanel() {
  const [notifs, setNotifs] = useSharedNotifications()
  const [filter, setFilter] = useState<"All" | "Unread">("All")
  const unread = notifs.filter(n => !n.read).length
  const visible = notifs.filter(n => filter === "All" || !n.read)
  const icons: Record<string, typeof AlertTriangle> = { urgent: AlertTriangle, warning: AlertTriangle, success: CheckCircle, info: Bell }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5">
          {(["All", "Unread"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`flex items-center gap-1.5 px-3 py-1 text-[11px] font-semibold rounded-full transition-all font-sans ${filter === f ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"}`}>
              {f}{f === "Unread" && unread > 0 && <span className="px-1 py-0.5 rounded bg-[#F87171]/20 text-[#F87171] text-[9px]">{unread}</span>}
            </button>
          ))}
        </div>
        <button onClick={() => setNotifs(ns => ns.map(n => ({ ...n, read: true })))}
          className="text-[11px] text-muted-foreground hover:text-foreground font-sans transition-colors">Mark all read</button>
      </div>
      <div className="flex flex-col gap-2">
        {visible.map(n => {
          const s = notifStyle(n.type)
          const Icon = icons[n.type]
          return (
            <div key={n.id} onClick={() => setNotifs(ns => ns.map(x => x.id === n.id ? { ...x, read: true } : x))}
              className={`flex gap-3 p-3 rounded-xl border border-l-4 cursor-pointer transition-all ${s.border} ${s.bg} ${n.read ? "border-border opacity-70" : "border-border"}`}>
              <Icon size={15} className={`mt-0.5 shrink-0 ${s.icon}`} />
              <div className="flex-1 min-w-0">
                <p className={`text-[12px] font-sans font-semibold ${n.read ? "text-muted-foreground" : "text-foreground"}`}>{n.text}</p>
                <p className="text-[10px] text-muted-foreground mt-1 font-mono">{n.time}</p>
              </div>
              {!n.read && <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Service News Panel ────────────────────────────────────────────────────────
function ServiceNewsPanel() {
  const catColors: Record<string, string> = {
    Campaign: "bg-[#F87171]/20 text-[#F87171] border border-[#F87171]/20",
    Training: "bg-primary/20 text-primary border border-primary/20",
    Update: "bg-[#FACC15]/20 text-[#FACC15] border border-[#FACC15]/20",
  }
  return (
    <div className="flex flex-col gap-3">
      {SERVICE_NEWS.map((news, i) => (
        <motion.div key={news.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
          className="p-4 rounded-xl bg-card border border-border hover:border-primary/25 transition-all cursor-pointer group">
          <div className="flex items-start justify-between gap-3 mb-2">
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-sans ${catColors[news.category] || "bg-muted text-muted-foreground"}`}>{news.category}</span>
            <span className="text-[10px] text-muted-foreground font-mono">{news.date}</span>
          </div>
          <p className="text-[13px] font-semibold text-foreground font-sans mb-1 group-hover:text-primary transition-colors">{news.title}</p>
          <p className="text-[12px] text-muted-foreground leading-relaxed">{news.summary}</p>
          <div className="flex gap-2 mt-3">
            <button className="flex items-center gap-1.5 text-primary text-[11px] font-semibold font-sans hover:text-accent transition-colors">
              <Eye size={11} /> Read More
            </button>
            <button className="flex items-center gap-1.5 text-muted-foreground text-[11px] font-semibold font-sans hover:text-foreground transition-colors">
              <Download size={11} /> Download
            </button>
          </div>
        </motion.div>
      ))}
    </div>
  )
}

// ── My Calls Panel ────────────────────────────────────────────────────────────
interface CallLog {
  id: string;
  name: string;
  number: string;
  status: "missed" | "scheduled" | "completed";
  time: string;
  vehicle: string;
  reason: string;
}

const INITIAL_CALLS: CallLog[] = [
  { id: "c1", name: "Rajat Sharma", number: "+91 98101 23456", status: "missed", time: "10:15 AM today", vehicle: "HR26CW7677", reason: "Service progress update request" },
  { id: "c2", name: "Anjali Gupta", number: "+91 99532 98765", status: "missed", time: "11:30 AM today", vehicle: "HR26FN3715", reason: "Confirming estimated delivery time" },
  { id: "c3", name: "Amit Kumar", number: "+91 97111 00223", status: "scheduled", time: "02:00 PM (Callback)", vehicle: "JH10CK2349", reason: "Part delay callback requested" },
  { id: "c4", name: "Preeti Singh", number: "+91 98188 55432", status: "completed", time: "09:45 AM today", vehicle: "MH01HK4521", reason: "Appointment confirmation" },
];

function CallsPanel() {
  const [calls, setCalls] = useState<CallLog[]>(() => {
    try {
      const cached = localStorage.getItem("nexa_calls")
      return cached ? JSON.parse(cached) : INITIAL_CALLS
    } catch (e) {
      return INITIAL_CALLS
    }
  })

  useEffect(() => {
    localStorage.setItem("nexa_calls", JSON.stringify(calls))
  }, [calls])
  const [filter, setFilter] = useState<"all" | "missed" | "scheduled">("all");
  const [activeCall, setActiveCall] = useState<CallLog | null>(null);
  const [callStatus, setCallStatus] = useState<"dialing" | "connected" | "ended">("dialing");
  const [callDuration, setCallDuration] = useState(0);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (activeCall && callStatus === "connected") {
      timer = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      setCallDuration(0);
    }
    return () => clearInterval(timer);
  }, [activeCall, callStatus]);

  useEffect(() => {
    let connectTimer: NodeJS.Timeout;
    if (activeCall && callStatus === "dialing") {
      connectTimer = setTimeout(() => {
        setCallStatus("connected");
      }, 2000);
    }
    return () => clearTimeout(connectTimer);
  }, [activeCall, callStatus]);

  const handleCall = (c: CallLog) => {
    setActiveCall(c);
    setCallStatus("dialing");
  };

  const handleEndCall = () => {
    setCallStatus("ended");
    setTimeout(() => {
      setCalls((prev) =>
        prev.map((item) =>
          item.id === activeCall?.id ? { ...item, status: "completed" } : item
        )
      );
      setActiveCall(null);
    }, 1200);
  };

  const filteredCalls = calls.filter((c) => {
    if (filter === "all") return true;
    return c.status === filter;
  });

  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col gap-4 font-sans">
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5">
          {(["all", "missed", "scheduled"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-lg border transition-all cursor-pointer ${
                filter === f
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card/60 border border-border text-muted-foreground hover:text-foreground hover:bg-card/90"
              }`}
            >
              {f} ({calls.filter((c) => f === "all" || c.status === f).length})
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {filteredCalls.map((c) => (
          <div
            key={c.id}
            className={`p-4 rounded-xl border transition-all duration-300 bg-card shadow-md ${
              c.status === "missed"
                ? "border-[#F87171]/20 hover:border-[#F87171]/40"
                : c.status === "scheduled"
                ? "border-[#FACC15]/20 hover:border-[#FACC15]/40"
                : "border-border hover:border-border"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    c.status === "missed"
                      ? "bg-[#F87171]/10 text-[#F87171]"
                      : c.status === "scheduled"
                      ? "bg-[#FACC15]/10 text-[#FACC15]"
                      : "bg-[#4ADE80]/10 text-[#4ADE80]"
                  }`}
                >
                  <Phone size={15} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[14px] font-bold text-foreground leading-none">{c.name}</p>
                    <span className="text-[10px] text-muted-foreground font-mono">{c.number}</span>
                  </div>
                  <p className="text-[11.5px] text-muted-foreground/85 font-medium mt-1">
                    Req: <span className="text-primary font-bold font-mono">{c.vehicle}</span> · {c.reason}
                  </p>
                  <p className="text-[10.5px] text-muted-foreground font-mono mt-1.5 flex items-center gap-1">
                    <Clock size={10} /> {c.time}
                  </p>
                </div>
              </div>

              {c.status !== "completed" && (
                <button
                  onClick={() => handleCall(c)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-primary/10 border border-primary/20 hover:bg-primary text-primary hover:text-white text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all duration-300 cursor-pointer shadow-sm active:scale-95 shrink-0"
                >
                  <Phone size={11} /> Call Back
                </button>
              )}
            </div>
          </div>
        ))}
        {filteredCalls.length === 0 && (
          <div className="text-center py-6 text-[12px] text-muted-foreground uppercase tracking-wider font-semibold">
            No calls found in this category
          </div>
        )}
      </div>

      {/* Simulated Phone Call Overlay */}
      <AnimatePresence>
        {activeCall && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 30 }}
              className="w-full max-w-sm bg-card border border-primary/30 rounded-2xl p-6 text-center shadow-2xl relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />
              
               <div className="relative mt-4 mb-6 inline-flex p-4 rounded-full bg-primary/10 border border-primary/20 animate-pulse">
                <div className="p-4 rounded-full bg-primary/20">
                  <Phone size={32} className="text-primary animate-bounce" />
                </div>
              </div>

              <h3 className="text-lg font-bold text-foreground">{activeCall.name}</h3>
              <p className="text-[11.5px] text-muted-foreground font-mono mt-1">{activeCall.number}</p>
              
              <div className="my-6 py-2.5 px-4 bg-card/60 rounded-xl inline-block">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground/80 font-bold leading-none">
                  {callStatus === "dialing" ? "DIALING..." : callStatus === "connected" ? "CONNECTED" : "CALL ENDED"}
                </p>
                {callStatus === "connected" && (
                  <p className="text-[18px] font-bold font-mono text-primary mt-1">
                    {formatDuration(callDuration)}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-center gap-4 mt-4">
                <button
                  onClick={handleEndCall}
                  className="w-12 h-12 rounded-full bg-[#F87171] hover:bg-[#F87171]/90 flex items-center justify-center text-white transition-all hover:scale-105 active:scale-95 cursor-pointer"
                >
                  <Phone size={20} className="rotate-[135deg]" />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Suzuki Connect request form panel ─────────────────────────────────────────
function SuzukiConnectFormPanel({ onAction }: { onAction: (a: PanelType, d?: Record<string, unknown>) => void }) {
  const [selectedReg, setSelectedReg] = useState("HR26CW7677")
  const [scanStatus, setScanStatus] = useState<"idle" | "scanning" | "complete">("idle")
  const [progress, setProgress] = useState(0)
  const [activeLog, setActiveLog] = useState("")
  const [batteryHealth, setBatteryHealth] = useState(94)

  const vehiclesList = [
    { reg: "HR26CW7677", model: "Baleno Petrol Alpha" },
    { reg: "DL6CR1517", model: "Baleno Petrol Delta" },
    { reg: "JH10CK2349", model: "New Wagon R 1L" },
    { reg: "HR26FN3715", model: "Grand Vitara Strong Hybrid" }
  ]

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (scanStatus === "scanning") {
      setProgress(0)
      const logs = [
        "Initializing secure cellular session with vehicle telematics server...",
        "Authorizing connection using encrypted CAN-Bus digital keys...",
        "Sending live remote query signal to On-Board Diagnostic (OBD) board...",
        "Retrieving powertrain control, fuel distribution & throttle sensor indices...",
        "Decoding live diagnostic trouble codes (DTC) and battery wear thresholds...",
        "Parsing final automotive diagnostic status report..."
      ]
      let step = 0
      setActiveLog(logs[0])

      interval = setInterval(() => {
        setProgress(prev => {
          const next = prev + 8
          if (next >= 100) {
            clearInterval(interval)
            setScanStatus("complete")
            return 100
          }
          const logIdx = Math.floor((next / 100) * logs.length)
          if (logs[logIdx] && logs[logIdx] !== activeLog) {
            setActiveLog(logs[logIdx])
          }
          return next
        })
      }, 100)
    }

    if (scanStatus === "complete") {
      interval = setInterval(() => {
        setBatteryHealth(prev => {
          const change = Math.random() > 0.5 ? 0.01 : -0.01;
          return parseFloat(Math.min(100, Math.max(80, prev + change)).toFixed(2));
        });
      }, 3000);
    }

    return () => clearInterval(interval)
  }, [scanStatus, activeLog])

  return (
    <div className="flex flex-col gap-5 p-1">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[17px] font-bold font-sans uppercase tracking-wider text-foreground">Suzuki Connect Diagnostic Hub</h2>
          <p className="text-[11.5px] text-muted-foreground font-sans mt-0.5">Query live vehicle telemetry and run off-board electronic diagnostic protocols.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => onAction("suzuki-connect-advice")} className="px-3.5 py-1.5 bg-card hover:bg-muted font-semibold text-[11.5px] text-foreground rounded-lg border border-border transition-colors cursor-pointer font-sans flex items-center gap-1.5"><Lightbulb size={13} className="text-primary" /> Advice Board</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="md:col-span-1 p-5 rounded-2xl bg-card border border-border flex flex-col justify-between">
          <div>
            <p className="text-[11px] uppercase font-sans font-black tracking-widest text-[#FB923C] mb-4">Diagnostics Console</p>
            
            <label className="text-[11px] uppercase font-sans font-bold text-muted-foreground block mb-1.5">Select Workshop Vehicle</label>
            <div className="relative mb-4">
              <select 
                value={selectedReg} 
                onChange={e => { setSelectedReg(e.target.value); setScanStatus("idle"); }}
                className="w-full text-[13px] px-3.5 py-2 bg-card border border-border focus:border-primary/50 text-foreground rounded-xl outline-none font-mono appearance-none cursor-pointer"
              >
                {vehiclesList.map(v => (
                  <option key={v.reg} value={v.reg}>{v.reg} — {v.model}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3.5 top-3.5 text-muted-foreground pointer-events-none" size={13} />
            </div>

            <div className="space-y-2 text-[12px] font-sans text-muted-foreground mb-6">
              <div className="flex justify-between py-1 border-b border-border">
                <span>Hardware Module</span>
                <span className="text-foreground font-mono">Suzuki-Connect v2.9</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border">
                <span>IP Address</span>
                <span className="text-foreground font-mono">10.158.45.192</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border">
                <span>CAN-Bus Integrity</span>
                <span className="text-[#4ADE80] font-semibold font-sans">SECURE SEC-3</span>
              </div>
            </div>
          </div>

          <button 
            onClick={() => { setScanStatus("scanning"); }}
            disabled={scanStatus === "scanning"}
            className="w-full py-3 bg-gradient-to-r from-primary to-accent hover:from-primary/95 hover:to-accent/95 text-white font-bold text-[13px] rounded-xl font-sans tracking-wider cursor-pointer shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            {scanStatus === "scanning" ? "DIAGNOSTIC SCAN ACTIVE..." : "RUN FULL OBD SCAN"}
          </button>
        </div>

        <div className="md:col-span-2 p-5 rounded-2xl bg-card border border-border min-h-[300px] flex flex-col justify-center relative overflow-hidden">
          {scanStatus === "idle" && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-[56px] h-[56px] rounded-full bg-[#FB923C]/10 border border-[#FB923C]/20 flex items-center justify-center text-[#FB923C] mb-4">
                <Wifi size={24} />
              </div>
              <h3 className="text-[14px] font-bold font-sans uppercase tracking-wider text-foreground mb-1.5">No Active Diagnosis Protocol</h3>
              <p className="text-[12px] text-muted-foreground font-sans max-w-sm">Select a vehicle from the console and run OBD diagnostics scan to retrieve dynamic telematics status.</p>
            </div>
          )}

          {scanStatus === "scanning" && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="relative w-16 h-16 mb-6">
                <div className="absolute inset-0 rounded-full border-4 border-[#142035]" />
                <motion.div 
                  className="absolute inset-0 rounded-full border-4 border-[#FB923C] border-t-transparent"
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                />
                <div className="absolute inset-0 flex items-center justify-center text-[#FB923C] text-[15px] font-black font-sans">
                  {progress}%
                </div>
              </div>
              <h3 className="text-[14px] font-bold font-sans uppercase tracking-wider text-foreground mb-2">OBD Diagnostics Check In Progress</h3>
              <p className="text-[11px] text-muted-foreground font-sans max-w-sm h-12 leading-relaxed italic">
                "{activeLog}"
              </p>
            </div>
          )}

          {scanStatus === "complete" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#4ADE80] animate-pulse" />
                  <span className="text-[12px] font-bold font-sans uppercase tracking-widest text-[#4ADE80]">{selectedReg} TELEMETRY FEED LIVE</span>
                </div>
                <button onClick={() => setScanStatus("idle")} className="text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:underline transition-all cursor-pointer font-sans">CLEAN START</button>
              </div>

              {/* Bento diagnostics details */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 py-1">
                <div className="p-3 bg-card/60 rounded-xl border border-border text-left">
                  <p className="text-[10px] text-muted-foreground uppercase font-sans tracking-wide">Fuel Remaining</p>
                  <p className="text-[18px] font-bold font-mono text-white mt-1">68%</p>
                  <div className="w-full h-1 bg-card rounded-full overflow-hidden mt-2.5">
                    <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: "68%" }} />
                  </div>
                </div>
                <div className="p-3 bg-card/60 rounded-xl border border-border text-left">
                  <p className="text-[10px] text-muted-foreground uppercase font-sans tracking-wide">Battery Status</p>
                  <p className="text-[18px] font-bold font-mono text-[#4ADE80] mt-1">12.6V</p>
                  <p className="text-[10px] font-semibold font-sans text-[#4ADE80] mt-1 uppercase">Excellent (89%)</p>
                </div>
                <div className="p-3 bg-card/60 rounded-xl border border-border text-left relative overflow-hidden group">
                  <p className="text-[10px] text-muted-foreground uppercase font-sans tracking-wide">Battery Health</p>
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <p className="text-[18px] font-bold font-mono text-primary">{batteryHealth}%</p>
                    <motion.span 
                      animate={{ opacity: [0.4, 1, 0.4] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="text-[9px] font-black text-[#4ADE80] uppercase tracking-tighter"
                    >
                      Real-time
                    </motion.span>
                  </div>
                  <div className="w-full h-1 bg-muted rounded-full overflow-hidden mt-2.5">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${batteryHealth}%` }}
                      className="h-full bg-primary"
                    />
                  </div>
                </div>
                <div className="p-3 bg-card/60 rounded-xl border border-border text-left">
                  <p className="text-[10px] text-muted-foreground uppercase font-sans tracking-wide">Tire Pressures</p>
                  <p className="text-[18px] font-bold font-mono text-white mt-1">32 PSI</p>
                  <p className="text-[10px] font-medium font-sans text-muted-foreground mt-1">FL 32 · FR 32 · RL 31</p>
                </div>
                <div className="p-3 bg-card/60 rounded-xl border border-border text-left">
                  <p className="text-[10px] text-muted-foreground uppercase font-sans tracking-wide">OBD Diagnostics</p>
                  <p className="text-[18px] font-bold font-mono text-white mt-1">0 Codes</p>
                  <span className="inline-block mt-1 px-1.5 py-0.2 px-1 text-[9px] font-bold font-sans rounded bg-[#4ADE80]/15 text-[#4ADE80] uppercase">HEALTHY</span>
                </div>
              </div>

              {/* Systems checklist */}
              <div className="rounded-xl border border-border bg-card/30 overflow-hidden">
                <div className="bg-card/40 px-4 py-2 text-[10px] uppercase font-sans font-bold tracking-wider text-muted-foreground">ECU Module Integrity Checks</div>
                <div className="grid grid-cols-2 gap-3 p-4 text-[11.5px] font-sans">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="text-[#4ADE80]" size={14} />
                    <span className="text-foreground">Engine Control Unit (ECU)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="text-[#4ADE80]" size={14} />
                    <span className="text-foreground">Anti-lock Braking System (ABS)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="text-[#4ADE80]" size={14} />
                    <span className="text-foreground">Supplemental Restraint (SRS)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="text-[#4ADE80]" size={14} />
                    <span className="text-foreground">Dynamic Cruise & ADAS</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 text-[11px] text-muted-foreground font-sans">
                <span>Diagnostic code: SUZ-CAN-PASS_OK17 - Gurugram Workshop</span>
                <span className="text-primary font-bold cursor-pointer hover:underline font-sans uppercase flex items-center gap-1.5"><Download size={11} strokeWidth={2.5} /> Save Report Logs</span>
              </div>
            </motion.div>
          )}

          {/* Grid lines styling to match dashboard feel */}
          <div className="absolute inset-x-0 bottom-0 top-1/2 bg-gradient-to-t from-primary/5 to-transparent blur-xl h-24 rotate-3 opacity-20 pointer-events-none" />
        </div>
      </div>
    </div>
  )
}

// ── Suzuki Connect drivable advice panel ──────────────────────────────────────
function SuzukiConnectAdvicePanel({ onAction }: { onAction: (a: PanelType, d?: Record<string, unknown>) => void }) {
  const [advices, setAdvices] = useState([
    { reg: "HR26FN3715", model: "Grand Vitara Hybrid", priority: "HIGH", code: "BAT-092", problem: "Weak Battery Drain Alert (11.8V)", action: "Recharge/replace battery under warranty, inspect remote drainage leak.", status: "Pending Decision" },
    { reg: "HR26FK2786", model: "Grand Vitara Smart", priority: "MEDIUM", code: "TYR-201", problem: "Continuous drop on FL Tyre (24 PSI)", action: "Schedule puncture strip visual checks and valve micro-leak audit.", status: "Pending Decision" },
    { reg: "JH10CK2349", model: "New Wagon R 1L", priority: "LOW", code: "TEL-001", problem: "Frequent cellular telematics packet drops", action: "Perform ECU TCU update to firmware build v4.2 under current JC.", status: "In Progress" },
    { reg: "DL6CR1517", model: "Baleno Petrol Delta", priority: "INFO", code: "BRK-404", problem: "Brake Lining Sensor Threshold Warning", action: "Brake pad replacement recommendation at next PMS visit (~2,500km).", status: "Completed" }
  ])

  const notifyUser = (reg: string) => {
    alert(`Alert notification has been successfully dispatched to the assigned Service Advisor workspace for vehicle ${reg}.`);
  }

  return (
    <div className="flex flex-col gap-5 p-1">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[17px] font-bold font-sans uppercase tracking-wider text-foreground">Suzuki Connect Drivable Advice</h2>
          <p className="text-[11.5px] text-muted-foreground font-sans mt-0.5">Live telemetry notifications and pre-emptive maintenance warnings.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => onAction("suzuki-connect-form")} className="px-3.5 py-1.5 bg-card hover:bg-muted font-semibold text-[11.5px] text-foreground rounded-lg border border-border transition-colors cursor-pointer font-sans flex items-center gap-1.5"><Wifi size={13} className="text-[#FB923C]" /> Manual Diagnostics</button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-[11.5px] border-collapse">
          <thead>
            <tr className="border-b border-border bg-card/60 text-muted-foreground">
              <th className="px-4 py-3 text-left font-semibold text-[10px] tracking-wider uppercase font-sans">Vehicle</th>
              <th className="px-4 py-3 text-left font-semibold text-[10px] tracking-wider uppercase font-sans">Priority</th>
              <th className="px-4 py-3 text-left font-semibold text-[10px] tracking-wider uppercase font-sans">Telemetry Advisory</th>
              <th className="px-4 py-3 text-left font-semibold text-[10px] tracking-wider uppercase font-sans">Recommended SA Action</th>
              <th className="px-4 py-3 text-left font-semibold text-[10px] tracking-wider uppercase font-sans">Status</th>
              <th className="px-4 py-3 text-center font-semibold text-[10px] tracking-wider uppercase font-sans">Control Screen</th>
            </tr>
          </thead>
          <tbody>
            {advices.map((a, i) => (
              <tr key={i} className="border-b border-border hover:bg-card/25 transition-colors duration-150">
                <td className="px-4 py-3.5 whitespace-nowrap text-left">
                  <p className="text-[12.5px] font-bold font-mono text-primary">{a.reg}</p>
                  <p className="text-[10px] text-muted-foreground font-sans mt-0.5">{a.model}</p>
                </td>
                <td className="px-4 py-3.5 whitespace-nowrap text-left">
                  <span className={`px-2 py-0.5 rounded text-[9.5px] font-extrabold font-sans ${
                    a.priority === "HIGH" ? "bg-red-400/15 text-[#F87171] border border-red-400/20" :
                    a.priority === "MEDIUM" ? "bg-[#FB923C]/15 text-[#FB923C] border border-[#FB923C]/20" :
                    a.priority === "LOW" ? "bg-primary/20 text-primary border border-primary/20" :
                    "bg-[#34D399]/15 text-[#34D399] border border-[#34D399]/20"
                  }`}>
                    {a.priority}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-left max-w-[180px]">
                  <p className="text-[11.5px] font-bold font-sans text-foreground">{a.problem}</p>
                  <p className="text-[9.5px] font-mono text-muted-foreground/80 mt-0.5 uppercase">ID: {a.code}</p>
                </td>
                <td className="px-4 py-3.5 text-left max-w-[200px] text-muted-foreground leading-relaxed font-sans">{a.action}</td>
                <td className="px-4 py-3.5 whitespace-nowrap text-left">
                  <span className={`text-[11px] font-bold font-sans ${
                    a.status === "Pending Decision" ? "text-[#FB923C]" :
                    a.status === "In Progress" ? "text-primary" : "text-[#4ADE80]"
                  }`}>
                    {a.status.toUpperCase()}
                  </span>
                </td>
                <td className="px-4 py-3.5 whitespace-nowrap text-center">
                  <div className="flex items-center justify-center gap-2">
                    <button 
                      onClick={() => {
                        setAdvices(prev => {
                          const n = [...prev]
                          n[i].status = "In Progress"
                          return n
                        })
                        notifyUser(a.reg)
                      }}
                      disabled={a.status === "Completed" || a.status === "In Progress"}
                      className="px-2.5 py-1 text-[10px] font-bold font-sans bg-card border border-border hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed text-foreground rounded transition-colors"
                    >
                      PUSH TO TERMINAL
                    </button>
                    {a.status === "Pending Decision" && (
                      <button 
                        onClick={() => {
                          setAdvices(prev => {
                            const n = [...prev]
                            n[i].status = "Completed"
                            return n
                          })
                        }}
                        className="px-2.5 py-1 text-[10px] font-bold font-sans bg-primary text-primary-foreground hover:bg-primary/95 rounded transition-colors"
                      >
                        DISPATCH ESTIMATE
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Panel Renderer ─────────────────────────────────────────────────────────────
function PanelRenderer({ panel, onAction, initialData }: { panel: PanelType; onAction: (a: PanelType, d?: Record<string, unknown>) => void; initialData?: Record<string, unknown> }) {
  if (panel === "welcome") return <WelcomePanel onAction={onAction} />
  if (panel === "appointments") return <AppointmentsPanel onAction={onAction} />
  if (panel === "vehicle-history") return <VehicleHistoryPanel initialReg={initialData?.regNo as string} />
  if (panel === "jc-opening") return <JCOpeningPanel initialReg={initialData?.regNo as string} />
  if (panel === "all-jobcards") return <AllJobCardsPanel onAction={onAction} />
  if (panel === "tasks") return <TasksPanel />
  if (panel === "notifications") return <NotificationsPanel />
  if (panel === "service-news") return <ServiceNewsPanel />
  if (panel === "my-calls") return <CallsPanel />
  if (panel === "suzuki-connect-form") return <SuzukiConnectFormPanel onAction={onAction} />
  if (panel === "suzuki-connect-advice") return <SuzukiConnectAdvicePanel onAction={onAction} />
  if (panel === "close-jobcard") return <CloseJobCardPanel initialReg={initialData?.regNo as string} initialJcNo={initialData?.jcNo as string} onBack={() => onAction("all-jobcards")} />
  return null
}

// ── Message Components ─────────────────────────────────────────────────────────
function JCChatStepRenderer({
  stepCode,
  jcSession,
  setJcSession,
  advanceJcChat,
  isActive
}: {
  stepCode: string;
  jcSession: any;
  setJcSession: (s: any) => void;
  advanceJcChat: (label: string, fields: any, nextStep: string) => void;
  isActive: boolean;
}) {
  if (!jcSession) return null;

  // Local state wrappers
  const [tempReg, setTempReg] = useState(jcSession.regNo || "");
  const [name, setName] = useState(jcSession.customerName || "Ramesh Sharma");
  const [mobile, setMobile] = useState(jcSession.customerMobile || "9812345678");
  const [email, setEmail] = useState(jcSession.customerEmail || "ramesh.sharma@nexa.com");
  const [odo, setOdo] = useState(jcSession.odometer || "42500");
  const [srvType, setSrvType] = useState(jcSession.serviceType || "PMS");
  const [isCng, setIsCng] = useState(jcSession.isCng || false);
  const [videoAnalyzing, setVideoAnalyzing] = useState(false);
  const [videoPlayProgress, setVideoPlayProgress] = useState(0);
  const [isSignCaptured, setIsSignCaptured] = useState(false);
  const [showLiveScanner, setShowLiveScanner] = useState(false);

  // Sync state if session updates
  useEffect(() => {
    if (jcSession) {
      if (jcSession.regNo) setTempReg(jcSession.regNo);
      if (jcSession.customerName) setName(jcSession.customerName);
      if (jcSession.customerMobile) setMobile(jcSession.customerMobile);
      if (jcSession.customerEmail) setEmail(jcSession.customerEmail);
      if (jcSession.odometer) setOdo(jcSession.odometer);
      if (jcSession.serviceType) setSrvType(jcSession.serviceType);
      if (jcSession.isCng !== undefined) setIsCng(jcSession.isCng);
    }
  }, [jcSession]);

  // Read-only compact representation for historical steps
  if (!isActive) {
    switch (stepCode) {
      case "VIN_SCAN":
        return (
          <div className="mt-2 text-xs text-muted-foreground bg-muted/25 px-3 py-1.5 rounded-lg border border-border inline-block font-sans">
            ✓ Logged Vehicle Registration: <strong className="text-secondary font-mono">{jcSession.regNo}</strong>
          </div>
        );
      case "CONFIRM_VEHICLE":
        return (
          <div className="mt-2 text-xs text-muted-foreground bg-muted/25 px-3 py-1.5 rounded-lg border border-border inline-block font-sans">
            ✓ Confirmed: 2022 Maruti Grand Swift VXi
          </div>
        );
      case "CUSTOMER_DETAILS":
        return (
          <div className="mt-2 text-xs text-muted-foreground bg-muted/25 px-3 py-1.5 rounded-lg border border-border inline-block font-sans">
            ✓ Customer: <strong>{jcSession.customerName}</strong> ({jcSession.customerMobile})
          </div>
        );
      case "ODOMETER":
        return (
          <div className="mt-2 text-xs text-muted-foreground bg-muted/25 px-3 py-1.5 rounded-lg border border-border inline-block font-sans">
            ✓ Odometer reading: <strong className="font-mono">{jcSession.odometer} KM</strong>
          </div>
        );
      case "SERVICE_TYPE":
        return (
          <div className="mt-2 text-xs text-muted-foreground bg-muted/25 px-3 py-1.5 rounded-lg border border-border inline-block font-sans">
            ✓ Service Category: <strong className="uppercase">{jcSession.serviceType}</strong> {jcSession.isCng ? "(CNG Enabled)" : ""}
          </div>
        );
      case "DENT_VIDEO":
        return (
          <div className="mt-2 text-xs text-muted-foreground bg-muted/25 px-3 py-1.5 rounded-lg border border-border inline-block font-sans">
            ✓ Condition Checklist: {jcSession.dents?.length || 3} Dents identified | Fuel Status: {jcSession.fuelLevel} | 3 Snaps logged
          </div>
        );
      case "INVENTORY":
        return (
          <div className="mt-2 text-xs text-muted-foreground bg-muted/25 px-3 py-1.5 rounded-lg border border-border inline-block font-sans">
            ✓ Cabin Inventory Checklist Approved
          </div>
        );
      case "FITMENTS":
        return (
          <div className="mt-2 text-xs text-muted-foreground bg-muted/25 px-3 py-1.5 rounded-lg border border-border inline-block font-sans">
            ✓ Non-OEM Fitments verified: {jcSession.fitments?.length ? jcSession.fitments.join(", ") : "None Detected"}
          </div>
        );
      case "TYRE_BATTERY":
        return (
          <div className="mt-2 text-xs text-muted-foreground bg-muted/25 px-3 py-1.5 rounded-lg border border-border inline-block font-sans">
            ✓ FL Tyre rated 2/5 (Recommending Change) | Battery health: {jcSession.batteryHealth}
          </div>
        );
      case "SERVICE_MENU":
        return (
          <div className="mt-2 text-xs text-muted-foreground bg-muted/25 px-3 py-1.5 rounded-lg border border-border inline-block font-sans">
            ✓ Standard {jcSession.serviceType} Checklist items pre-populated
          </div>
        );
      case "DEMANDS_LIST":
        return (
          <div className="mt-2 text-xs text-muted-foreground bg-muted/25 px-3 py-1.5 rounded-lg border border-border inline-block font-sans">
            ✓ Target Promised Delivery: {jcSession.promisedDateTime} | Payment Mode: {jcSession.paymentMode}
          </div>
        );
      case "LABOUR_PARTS":
        return (
          <div className="mt-2 text-xs text-muted-foreground bg-muted/25 px-3 py-1.5 rounded-lg border border-border inline-block font-sans">
            ✓ Final job estimate items added
          </div>
        );
      case "SUMMARY":
        return (
          <div className="mt-2 text-xs text-muted-foreground bg-muted/25 px-3 py-1.5 rounded-lg border border-border inline-block font-sans">
            ✓ Digital Customer Signature stored in system
          </div>
        );
      default:
        return null;
    }
  }

  // Active step rendering
  switch (stepCode) {
    case "VIN_SCAN": {
      return (
        <div className="mt-3 p-4 bg-card/90 rounded-xl border border-border shadow-xl flex flex-col gap-3">
          <div className="flex gap-2">
            <input 
              type="text"
              value={tempReg}
              onChange={(e) => setTempReg(e.target.value.toUpperCase())}
              placeholder="MH12AB1234, DL6CR1517..."
              className="flex-1 px-3 py-2 bg-card border border-border rounded-lg text-foreground outline-none focus:border-primary/50 font-mono text-[13px] uppercase"
            />
            <button
              onClick={() => {
                setTempReg("DL6CR1517");
                advanceJcChat("Captured plate DL6CR1517 📷", { regNo: "DL6CR1517" }, "CONFIRM_VEHICLE");
              }}
              className="px-3.5 py-2 bg-card hover:bg-muted border border-border text-[12px] font-bold rounded-lg text-foreground font-sans flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Camera size={13} className="text-secondary" /> Scan
            </button>
          </div>
          <button
            disabled={!tempReg}
            onClick={() => advanceJcChat(`Vehicle registration: ${tempReg}`, { regNo: tempReg }, "CONFIRM_VEHICLE")}
            className="w-full py-2 bg-primary text-primary-foreground text-[12px] font-extrabold rounded-lg font-sans shadow-lg transition-all hover:brightness-110 disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer"
          >
            Fetch Details from DMS
          </button>
        </div>
      );
    }

    case "CONFIRM_VEHICLE": {
      return (
        <div className="mt-3 p-4 bg-card/90 rounded-xl border border-border shadow-xl flex flex-col gap-3">
          <div className="p-3 bg-card/40 rounded-lg border border-border text-[12px] font-sans flex flex-col gap-1.5">
            <div className="flex justify-between border-b border-border pb-1.5">
              <span className="text-muted-foreground">Class</span>
              <span className="font-semibold text-foreground">Premium Hatchback (Swift)</span>
            </div>
            <div className="flex justify-between border-b border-border pb-1.5">
              <span className="text-muted-foreground">Chassis (VIN)</span>
              <span className="font-mono text-foreground font-semibold">MA3EWDE1S00XXXXX</span>
            </div>
            <div className="flex justify-between pb-1.5">
              <span className="text-muted-foreground">Registration No.</span>
              <span className="font-mono text-primary font-semibold">{jcSession.regNo}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => advanceJcChat("Correct, continue", {}, "CUSTOMER_DETAILS")}
              className="flex-1 py-2 bg-primary text-primary-foreground text-[12px] font-semibold rounded-lg font-sans text-center cursor-pointer hover:brightness-105"
            >
              ✓ Yes, Correct
            </button>
            <button
              onClick={() => advanceJcChat("Go back to search", {}, "VIN_SCAN")}
              className="px-4 py-2 bg-card hover:bg-muted border border-border text-[12px] font-semibold rounded-lg text-foreground font-sans cursor-pointer transition-colors"
            >
              Edit reg
            </button>
          </div>
        </div>
      );
    }

    case "CUSTOMER_DETAILS": {
      return (
        <div className="mt-3 p-4 bg-card/90 rounded-xl border border-border shadow-xl flex flex-col gap-3">
          <div className="flex flex-col gap-2 font-sans">
            <div>
              <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block mb-1">Customer Full Name *</label>
              <input 
                type="text" 
                value={name} 
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-1.5 bg-card border border-border rounded-lg text-foreground text-[12px] focus:border-primary/50 outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block mb-1">Mobile Contact *</label>
              <input 
                type="text" 
                value={mobile} 
                onChange={(e) => setMobile(e.target.value)}
                className="w-full px-3 py-1.5 bg-card border border-border rounded-lg text-foreground text-[12px] focus:border-primary/50 outline-none font-mono"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block mb-1">Email Address</label>
              <input 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-1.5 bg-card border border-border rounded-lg text-foreground text-[12px] focus:border-primary/50 outline-none"
              />
            </div>
          </div>
          <button
            onClick={() => advanceJcChat(`Customer info confirmed for ${name}`, { customerName: name, customerMobile: mobile, customerEmail: email }, "ODOMETER")}
            className="w-full py-2 bg-primary text-primary-foreground text-[12px] font-extrabold rounded-lg font-sans cursor-pointer transition-all hover:brightness-115"
          >
            Confirm Contact Details
          </button>
        </div>
      );
    }

    case "ODOMETER": {
      return (
        <div className="mt-3 p-4 bg-card/90 rounded-xl border border-border shadow-xl flex flex-col gap-3">
          <div className="flex gap-2">
            <input 
              type="number"
              value={odo}
              onChange={(e) => setOdo(e.target.value)}
              placeholder="Odometer reading..."
              className="flex-1 px-3 py-2 bg-card border border-border rounded-lg text-foreground outline-none focus:border-primary/50 font-mono text-[13px]"
            />
            <span className="bg-card border border-border px-3.5 py-2 rounded-lg text-[12px] font-bold text-muted-foreground flex items-center">KM</span>
          </div>
          {/* Quick reply chips */}
          <div className="flex gap-1.5 py-1 select-none overflow-x-auto">
            {["42500", "39800", "10000"].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setOdo(preset)}
                className="px-2.5 py-1 bg-card hover:bg-muted text-[11px] rounded-full border border-border text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              >
                {parseInt(preset).toLocaleString()} km
              </button>
            ))}
          </div>
          <button
            disabled={!odo}
            onClick={() => advanceJcChat(`Odometer reading: ${parseInt(odo).toLocaleString()} KM`, { odometer: odo }, "SERVICE_TYPE")}
            className="w-full py-2 bg-primary text-primary-foreground text-[12px] font-extrabold rounded-lg font-sans cursor-pointer transition-all hover:brightness-110 disabled:opacity-40"
          >
            Confirm Odometer
          </button>
        </div>
      );
    }

    case "SERVICE_TYPE": {
      return (
        <div className="mt-3 p-4 bg-card/90 rounded-xl border border-border shadow-xl flex flex-col gap-3">
          <div>
            <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block mb-1">Select Service Schedule</label>
            <div className="grid grid-cols-2 gap-2 font-sans">
              {["PMS", "IPC", "IFC", "Paid Repair"].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setSrvType(t)}
                  className={`py-2 text-[12px] font-bold rounded-lg border transition-all cursor-pointer ${srvType === t ? "bg-primary border-primary text-primary-foreground shadow-lg" : "bg-card hover:bg-muted border-border text-foreground"}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="border-t border-border pt-2.5 flex items-center justify-between font-sans">
            <div>
              <p className="text-[12.5px] font-bold text-foreground">Is this a CNG vehicle?</p>
              <p className="text-[10px] text-muted-foreground">Auto-checked against DMS registration specs</p>
            </div>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setIsCng(true)}
                className={`px-3.5 py-1 text-[11px] font-bold rounded-full border cursor-pointer transition-all ${isCng ? "bg-secondary border-secondary text-primary-foreground font-extrabold" : "bg-card border-border text-foreground hover:bg-muted"}`}
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => setIsCng(false)}
                className={`px-3.5 py-1 text-[11px] font-bold rounded-full border cursor-pointer transition-all ${!isCng ? "bg-secondary border-secondary text-primary-foreground font-extrabold" : "bg-card border-border text-foreground hover:bg-muted"}`}
              >
                No
              </button>
            </div>
          </div>
          <button
            onClick={() => advanceJcChat(`Category: ${srvType} (CNG: ${isCng ? "Yes" : "No"})`, { serviceType: srvType, isCng }, "DENT_VIDEO")}
            className="w-full mt-1.5 py-2 bg-primary text-primary-foreground text-[12px] font-extrabold rounded-lg font-sans cursor-pointer transition-colors hover:brightness-110"
          >
            Configure Service Type
          </button>
        </div>
      );
    }

    case "DENT_VIDEO": {
      const startVideoSimulation = () => {
        setVideoAnalyzing(true);
        setVideoPlayProgress(0);
        const timer = setInterval(() => {
          setVideoPlayProgress((prev) => {
            if (prev >= 100) {
              clearInterval(timer);
              return 100;
            }
            return prev + 10;
          });
        }, 150);
      };

      const aiDetectedDents = [
        { id: "d1", zone: "front_bumper", type: "scratch", severity: "minor", confidence: 0.94, frame_image_url: "/frame_001.jpg" },
        { id: "d2", zone: "left_rear_door", type: "dent", severity: "moderate", confidence: 0.89, frame_image_url: "/frame_011.jpg" },
        { id: "d3", zone: "right_fender", type: "paint_chip", severity: "minor", confidence: 0.91, frame_image_url: "/frame_021.jpg" }
      ];

      return (
        <div className="mt-3 p-4 bg-card/90 rounded-xl border border-border shadow-xl flex flex-col gap-3 font-sans">
          
          <AnimatePresence>
            {showLiveScanner && (
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
              >
                <VehicleScanner 
                  onClose={() => setShowLiveScanner(false)}
                  onScan={(images) => {
                    setShowLiveScanner(false);
                    // Handle captured images
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Main Select Row */}
          {!videoAnalyzing && videoPlayProgress === 0 ? (
      <div className="grid grid-cols-3 gap-2">
              <label 
                className="flex flex-col items-center gap-1.5 p-3 rounded-lg border border-border bg-card hover:bg-muted transition-colors cursor-pointer text-center"
              >
                <input type="file" accept="video/*" className="hidden" onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    startVideoSimulation();
                  }
                }} />
                <Upload size={20} className="text-foreground" />
                <span className="text-[11px] font-bold text-foreground">UPLOAD VIDEO</span>
              </label>
              <button
                type="button"
                onClick={() => setShowLiveScanner(true)}
                className="flex flex-col items-center gap-1.5 p-3 rounded-lg border border-border bg-card hover:bg-muted transition-colors cursor-pointer text-center"
              >
                <Camera size={20} className="text-primary" />
                <span className="text-[11px] font-bold text-foreground">LIVE SCAN</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setVideoPlayProgress(100);
                  setJcSession({ ...jcSession, dents: aiDetectedDents });
                }}
                className="flex flex-col items-center gap-1.5 p-3 rounded-lg border border-border bg-card hover:bg-muted transition-colors cursor-pointer text-center"
              >
                <ClipboardList size={20} className="text-muted-foreground" />
                <span className="text-[11px] font-bold text-foreground">MARK MANUALLY</span>
              </button>
            </div>
          ) : videoAnalyzing && videoPlayProgress < 100 ? (
            <div className="p-4 rounded-xl bg-background border border-border text-center flex flex-col items-center gap-2">
              <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              <p className="text-[12px] font-bold text-foreground">Analyzing walkround recording video...</p>
              <div className="w-full bg-card h-1.5 rounded-full overflow-hidden mt-1">
                <div className="bg-primary h-full transition-all duration-150" style={{ width: `${videoPlayProgress}%` }} />
              </div>
              <p className="text-[9.5px] font-mono text-muted-foreground mt-0.5">{videoPlayProgress}% Keyframes analyzed</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="bg-[#4ADE80]/15 border border-[#4ADE80]/20 p-2.5 rounded-lg flex items-center gap-2">
                <CheckCircle size={15} className="text-[#4ADE80] shrink-0" />
                <div className="text-[11px]">
                  <p className="text-[#4ADE80] font-bold">NEXA AI Dent & Scratch Analysis Complete</p>
                  <p className="text-muted-foreground">Identified 3 vehicle outer panel issues (above 85% threshold)</p>
                </div>
              </div>

              {/* Vehicle Outline zones */}
              <div className="p-3.5 bg-background rounded-lg border border-border flex flex-col gap-2">
                <span className="text-[9px] font-extrabold uppercase tracking-widest text-[#4ADE80] font-mono">Dents Visual Layout Mapper</span>
                
                {/* 2D Grid map mock representation */}
                <div className="grid grid-cols-2 gap-1.5 text-[10.5px]">
                  <div className="p-1 px-2.5 rounded bg-primary/20 border border-primary/30 flex items-center justify-between">
                    <span>Front Bumper</span>
                    <span className="text-[9.5px] font-bold text-[#4ADE80] uppercase">✓ Scratch (94%)</span>
                  </div>
                  <div className="p-1 px-2.5 rounded bg-primary/20 border border-primary/30 flex items-center justify-between">
                    <span>Left Rear Door</span>
                    <span className="text-[9.5px] font-bold text-[#4ADE80] uppercase">✓ Dent 5cm (89%)</span>
                  </div>
                  <div className="p-1 px-2.5 rounded bg-primary/20 border border-primary/30 flex items-center justify-between">
                    <span>Right Fender</span>
                    <span className="text-[9.5px] font-bold text-[#4ADE80] uppercase">✓ Chip (91%)</span>
                  </div>
                  <div className="p-1 px-2.5 rounded bg-card/40 border border-border text-muted-foreground flex items-center justify-between">
                    <span>Bonnet / Hood</span>
                    <span className="text-[9.5px] font-semibold text-muted-foreground">Clear</span>
                  </div>
                </div>
              </div>

              {/* Fuel Level selects */}
              <div>
                <span className="text-[11px] font-bold text-foreground block mb-1">Fuel Status Level</span>
                <div className="grid grid-cols-5 gap-1.5">
                  {["E", "1/4", "1/2", "3/4", "F"].map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setJcSession({ ...jcSession, fuelLevel: lvl })}
                      className={`py-1 rounded text-[11px] font-bold border transition-colors cursor-pointer ${jcSession.fuelLevel === lvl ? "bg-primary border-primary text-primary-foreground" : "bg-card border-border text-muted-foreground"}`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Interior Snaps mock */}
              <div className="border-t border-border pt-2 flex justify-between items-center text-[11.5px]">
                <div className="flex items-center gap-1.5">
                  <Camera size={14} className="text-secondary" />
                  <span>Cabin Interior Snaps (Dashboard / Seat / Boot)</span>
                </div>
                <span className="text-[10px] bg-card border border-border text-secondary font-bold px-2 py-0.5 rounded font-mono">3 / 3 LOGGED</span>
              </div>

              <button
                onClick={() => {
                  const dentsToSend = jcSession.dents?.length ? jcSession.dents : aiDetectedDents;
                  advanceJcChat("Vehicle Condition & Dents confirmed ✅", { dents: dentsToSend, fuelLevel: jcSession.fuelLevel || "1/2" }, "INVENTORY");
                }}
                className="w-full py-2 bg-primary text-primary-foreground text-[12px] font-extrabold rounded-lg cursor-pointer hover:brightness-110"
              >
                Approve Inspection Report
              </button>
            </div>
          )}
        </div>
      );
    }

    case "INVENTORY": {
      const setInvQty = (key: string, v: number) => {
        const keyMap: any = { spareTyre: "spareTyre", jackWrench: "jackWrench", floorMats: "floorMats", umbrella: "umbrella" };
        const realKey = keyMap[key];
        if (realKey) {
          setJcSession({
            ...jcSession,
            inventory: {
              ...jcSession.inventory,
              [realKey]: Math.max(0, (jcSession.inventory[realKey] || 0) + v)
            }
          });
        }
      };

      const inv = jcSession.inventory || { spareTyre: 1, jackWrench: 1, floorMats: 4, umbrella: 1 };

      return (
        <div className="mt-3 p-4 bg-card/90 rounded-xl border border-border shadow-xl flex flex-col gap-3 font-sans">
          <div className="flex flex-col gap-2">
            {[
              { label: "Spare Tyre in Boot", stateKey: "spareTyre", val: inv.spareTyre },
              { label: "Jack & Toolkit", stateKey: "jackWrench", val: inv.jackWrench },
              { label: "Custom floor Mats", stateKey: "floorMats", val: inv.floorMats },
              { label: "Nexa Branded Umbrella", stateKey: "umbrella", val: inv.umbrella }
            ].map((itm) => (
              <div key={itm.stateKey} className="flex justify-between items-center bg-card/40 border border-border p-2 rounded-lg text-[12px]">
                <span className="font-semibold text-foreground">{itm.label}</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setInvQty(itm.stateKey, -1)}
                    className="w-5 h-5 rounded bg-card hover:bg-[#253954] text-muted-foreground hover:text-foreground flex items-center justify-center border border-border transition-colors cursor-pointer"
                  >
                    <Minus size={11} />
                  </button>
                  <span className="w-6 text-center font-bold font-mono text-primary text-[12.5px]">{itm.val}</span>
                  <button
                    type="button"
                    onClick={() => setInvQty(itm.stateKey, 1)}
                    className="w-5 h-5 rounded bg-card hover:bg-[#253954] text-muted-foreground hover:text-foreground flex items-center justify-center border border-border transition-colors cursor-pointer"
                  >
                    <Plus size={11} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => advanceJcChat("Inventory saved ✅", {}, "FITMENTS")}
            className="w-full py-2 bg-primary text-primary-foreground text-[12px] font-extrabold rounded-lg cursor-pointer hover:brightness-110"
          >
            Save Cabin Inventory
          </button>
        </div>
      );
    }

    case "FITMENTS": {
      const options = ["Aftermarket Alloy Wheels", "Non-OEM Rear Spoiler", "Stereo Music Upgrade", "Tinted Window Glass"];
      const current = jcSession.fitments || [];

      const selectFitment = (item: string) => {
        const nextFit = current.includes(item)
          ? current.filter((f: string) => f !== item)
          : [...current, item];
        setJcSession({ ...jcSession, fitments: nextFit });
      };

      return (
        <div className="mt-3 p-4 bg-card/90 rounded-xl border border-border shadow-xl flex flex-col gap-3 font-sans">
          <div className="flex flex-col gap-2">
            {options.map((opt) => {
              const checked = current.includes(opt);
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => selectFitment(opt)}
                  className={`p-2.5 text-left text-[12px] font-bold rounded-lg border transition-all flex items-center justify-between cursor-pointer ${checked ? "bg-primary/20 border-primary text-foreground" : "bg-card/40 border-border text-muted-foreground"}`}
                >
                  <span>{opt}</span>
                  <div className={`w-4 h-4 rounded border flex items-center justify-center ${checked ? "bg-primary border-primary text-primary-foreground" : "border-border"}`}>
                    {checked && <Check size={10} />}
                  </div>
                </button>
              );
            })}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => advanceJcChat(current.length ? `Fitments loaded: ${current.join(", ")}` : "Verified: No aftermarket additions", { fitments: current }, "TYRE_BATTERY")}
              className="flex-1 py-2 bg-primary text-primary-foreground text-[12px] font-semibold rounded-lg text-center cursor-pointer hover:brightness-110"
            >
              ✓ Save fitments
            </button>
            <button
              onClick={() => advanceJcChat("None, skip", { fitments: [] }, "TYRE_BATTERY")}
              className="px-4 py-2 bg-card/70 hover:bg-card border border-border text-[12px] font-semibold rounded-lg text-muted-foreground hover:text-foreground font-sans cursor-pointer transition-colors"
            >
              None
            </button>
          </div>
        </div>
      );
    }

    case "TYRE_BATTERY": {
      const wheels = ["fl", "fr", "rl", "rr", "spare"];
      const labels: any = { fl: "Front Left", fr: "Front Right", rl: "Rear Left", rr: "Rear Right", spare: "Spare tyre" };
      const currentWheelRatings = jcSession.tyreHealth || { fl: 4, fr: 4, rl: 4, rr: 4, spare: 4 };

      const setWheelRate = (wh: string, score: number) => {
        setJcSession({
          ...jcSession,
          tyreHealth: {
            ...currentWheelRatings,
            [wh]: score
          }
        });
      };

      const hasCriticalWheel = Object.values(currentWheelRatings).some((v: any) => v <= 2);

      return (
        <div className="mt-3 p-4 bg-card/90 rounded-xl border border-border shadow-xl flex flex-col gap-3 font-sans">
          <span className="text-[11px] font-semibold text-foreground">Rate Wheel Tread Depth (1 = Balding, 5 = Brand New)</span>
          <div className="flex flex-col gap-2">
            {wheels.map((wh) => {
              const score = currentWheelRatings[wh] || 4;
              return (
                <div key={wh} className="bg-card/40 border border-border p-2 rounded-lg text-[12px] flex justify-between items-center">
                  <span className="font-semibold text-foreground">{labels[wh]}</span>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setWheelRate(wh, idx)}
                        className={`w-5.5 h-5.5 rounded flex items-center justify-center text-[10.5px] font-bold border cursor-pointer transition-all ${score === idx ? (idx <= 2 ? "bg-red-500 border-red-500 text-white" : "bg-primary border-primary text-primary-foreground") : "bg-card border-border text-muted-foreground hover:text-foreground"}`}
                      >
                        {idx}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {hasCriticalWheel && (
            <div className="bg-red-500/15 border border-red-500/20 p-2 rounded-lg flex gap-1.5 text-[10.5px] items-center text-red-400">
              <AlertTriangle size={13} className="shrink-0" />
              <span>FL tyre health rated 2/5 (Critical). Tyre replacement demand added.</span>
            </div>
          )}

          {/* Battery section */}
          <div className="border-t border-border pt-2 flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold text-foreground">Battery Diagnostic State</span>
            <div className="grid grid-cols-4 gap-1">
              {["Good", "Fair", "Poor", "Skip"].map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setJcSession({ ...jcSession, batteryHealth: b })}
                  className={`py-1 text-[11px] font-semibold rounded border transition-colors cursor-pointer ${jcSession.batteryHealth === b ? (b === "Poor" ? "bg-red-500 border-red-500 text-white" : "bg-primary border-primary text-primary-foreground") : "bg-card border-border text-muted-foreground hover:text-foreground"}`}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => {
              // Automatically append replacement demand codes if critical
              const activeDemands = [...(jcSession.demands || [])];
              if (currentWheelRatings.fl <= 2 && !activeDemands.some((d: any) => d.code === "TYRE-FL")) {
                activeDemands.push({ id: "tyre-fl", desc: "Tyre Replacement - Front Left (Balding)", code: "TYRE-FL", type: "P", qty: 1, price: 3450, addedBy: "ai_auto" });
              }
              if (jcSession.batteryHealth === "Poor" && !activeDemands.some((d: any) => d.code === "HP000002")) {
                activeDemands.push({ id: "bat-rep", desc: "Exide Gold Battery Replacement (Diagnostic Faulty)", code: "HP000002", type: "P", qty: 1, price: 4200, addedBy: "ai_auto" });
              }
              
              advanceJcChat(
                "Tyres and Battery checked ✅", 
                { tyreHealth: currentWheelRatings, batteryHealth: jcSession.batteryHealth || "Good", demands: activeDemands }, 
                "SERVICE_MENU"
              );
            }}
            className="w-full mt-1.5 py-2 bg-primary text-primary-foreground text-[12px] font-extrabold rounded-lg cursor-pointer hover:brightness-110"
          >
            Confirm Tyre & Battery State
          </button>
        </div>
      );
    }

    case "SERVICE_MENU": {
      const pmsMenu = [
        { desc: "Engine Oil Change", code: "LOC001", type: "L" as const, qty: 1, price: 350 },
        { desc: "Oil Filter replacement", code: "68510-68L10", type: "P" as const, qty: 1, price: 285 },
        { desc: "Air Filter Element replacement", code: "68510-79J00", type: "P" as const, qty: 1, price: 540 },
        { desc: "Brake Caliper Pins greasing", code: "LOC012", type: "L" as const, qty: 1, price: 200 }
      ];

      return (
        <div className="mt-3 p-4 bg-card/90 rounded-xl border border-border shadow-xl flex flex-col gap-3 font-sans">
          <div className="p-3 bg-background border border-border rounded-xl flex flex-col gap-2.5">
            <div className="flex justify-between items-center text-[10px] font-extrabold uppercase text-foreground tracking-widest border-b border-border pb-1.5">
              <span>PMS standard items list (DMS pre-loaded)</span>
              <span>ESTIMATED VALUE</span>
            </div>
            {pmsMenu.map((itm) => (
              <div key={itm.code} className="flex justify-between items-center text-[12px]">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-foreground/10 border border-foreground/20 text-foreground font-bold">
                    {itm.type}
                  </span>
                  <span className="text-foreground">{itm.desc}</span>
                </div>
                <span className="font-mono text-[11.5px] text-foreground">₹{itm.price}</span>
              </div>
            ))}
          </div>

          <button
            onClick={() => advanceJcChat("Preloaded menu approved ✅", {}, "DEMANDS_LIST")}
            className="w-full py-2 bg-primary text-primary-foreground text-[12px] font-extrabold rounded-lg cursor-pointer hover:brightness-110"
          >
            Confirm Core Service Menu
          </button>
        </div>
      );
    }

    case "DEMANDS_LIST": {
      return (
        <div className="mt-3 p-4 bg-card/90 rounded-xl border border-border shadow-xl flex flex-col gap-3 font-sans">
          {/* Active Demands Scroll list */}
          <div className="flex flex-col gap-2 max-h-[140px] overflow-y-auto pr-1">
            {jcSession.demands?.map((d: any) => (
              <div key={d.id} className="p-2 border border-border rounded-lg bg-card/40 flex justify-between items-center text-[11.5px]">
                <div>
                  <p className="font-bold text-foreground">{d.desc}</p>
                  <p className="text-[9.5px] text-muted-foreground font-mono">Code: {d.code} | Class: {d.type === "L" ? "Labour" : "Part"}</p>
                </div>
                <span className="text-secondary font-bold font-mono text-[11px]">₹{d.price * d.qty}</span>
              </div>
            ))}
          </div>

          {/* Delivery dates */}
          <div className="grid grid-cols-2 gap-2 text-[11.5px]">
            <div>
              <span className="text-muted-foreground block mb-1">Promised Date & Time</span>
              <select
                value={jcSession.promisedDateTime}
                onChange={(e) => setJcSession({ ...jcSession, promisedDateTime: e.target.value })}
                className="w-full bg-card border border-border p-2 rounded-lg text-foreground outline-none text-[12px]"
              >
                <option value="Today 6 PM">Today (6:00 PM)</option>
                <option value="Tomorrow 5 PM">Tomorrow (5:00 PM)</option>
                <option value="Day after 12 PM">Day after tomorrow (12:00 PM)</option>
              </select>
            </div>
            <div>
              <span className="text-muted-foreground block mb-1">Preferred Settlement</span>
              <select
                value={jcSession.paymentMode}
                onChange={(e) => setJcSession({ ...jcSession, paymentMode: e.target.value })}
                className="w-full bg-card border border-border p-2 rounded-lg text-foreground outline-none text-[12px]"
              >
                <option value="Cash">Cash settlement</option>
                <option value="Card">Card settlement</option>
                <option value="Insurance">Insurance coverage Claim</option>
                <option value="UPI">UPI Digital Payment</option>
              </select>
            </div>
          </div>

          <button
            onClick={() => advanceJcChat(`Promised delivery: ${jcSession.promisedDateTime} | settlement: ${jcSession.paymentMode}`, {}, "LABOUR_PARTS")}
            className="w-full py-2 bg-primary text-primary-foreground text-[12px] font-extrabold rounded-lg cursor-pointer hover:brightness-110"
          >
            Save Demands & Continue
          </button>
        </div>
      );
    }

    case "LABOUR_PARTS": {
      const extraItems = [
        { desc: "Brake Pad Check Detail Layout", code: "LOC045", type: "L" as const, qty: 1, price: 150 },
        { desc: "Wiper Fluid concentrated pouch", code: "68510-79M10", type: "P" as const, qty: 1, price: 120 }
      ];

      const addExtraDem = (itm: any) => {
        const alr = jcSession.demands?.some((d: any) => d.code === itm.code);
        if (!alr) {
          const added = [...(jcSession.demands || []), { ...itm, id: itm.code, addedBy: "manual" }];
          setJcSession({ ...jcSession, demands: added });
        }
      };

      return (
        <div className="mt-3 p-4 bg-card/90 rounded-xl border border-border shadow-xl flex flex-col gap-3 font-sans">
          <span className="text-[11px] font-semibold text-foreground">Quick Frequently Requested Items list:</span>
          <div className="flex flex-col gap-2">
            {extraItems.map((itm) => {
              const added = jcSession.demands?.some((d: any) => d.code === itm.code);
              return (
                <div key={itm.code} className="bg-card/40 border border-border p-2 rounded-lg text-[12px] flex justify-between items-center">
                  <div>
                    <span className="font-bold text-foreground">{itm.desc}</span>
                    <span className="text-[10px] text-muted-foreground block font-mono">Code: {itm.code} | Cost: ₹{itm.price}</span>
                  </div>
                  <button
                    type="button"
                    disabled={added}
                    onClick={() => addExtraDem(itm)}
                    className={`px-3 py-1 rounded text-[10.5px] font-bold border transition-all cursor-pointer ${added ? "bg-[#4ADE80]/20 border-[#4ADE80]/30 text-[#4ADE80]" : "bg-card hover:bg-muted border-border text-muted-foreground hover:text-foreground"}`}
                  >
                    {added ? "✓ Added" : "+ Add"}
                  </button>
                </div>
              );
            })}
          </div>

          <button
            onClick={() => advanceJcChat("Estimate components checked and verified ✅", {}, "SUMMARY")}
            className="w-full py-2 bg-primary text-primary-foreground text-[12px] font-extrabold rounded-lg cursor-pointer hover:brightness-110 animate-fade-in"
          >
            Review Summary Card
          </button>
        </div>
      );
    }

    case "SUMMARY": {
      const activeDemands = jcSession.demands || [];
      const labourEst = activeDemands.filter((d: any) => d.type === "L").reduce((sum: number, d: any) => sum + d.price * d.qty, 0);
      const partsEst = activeDemands.filter((d: any) => d.type === "P").reduce((sum: number, d: any) => sum + d.price * d.qty, 0);
      const overall = labourEst + partsEst;

      return (
        <div className="mt-3 p-4 bg-card/90 rounded-xl border border-border shadow-xl flex flex-col gap-3 font-sans">
          <div className="bg-background border border-border rounded-xl p-3.5 flex flex-col gap-2 font-mono text-[11.5px]">
            <span className="text-secondary font-bold text-[10px] uppercase tracking-widest border-b border-border pb-1 block">SUMMARY PREVIEW CARD</span>
            <div className="flex justify-between mt-1"><span className="text-muted-foreground">Vehicle:</span><span className="text-foreground">Swift VXi ({jcSession.regNo})</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Customer:</span><span className="text-foreground">Ramesh Sharma</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Category:</span><span className="text-foreground block uppercase">{jcSession.serviceType}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Odometer:</span><span className="text-foreground">{parseInt(jcSession.odometer || "42500").toLocaleString()} km</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Est. Labour:</span><span className="text-foreground">₹{labourEst}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Est. Parts:</span><span className="text-foreground">₹{partsEst}</span></div>
            <div className="flex justify-between border-t border-border pt-1.5 font-bold text-[12.5px]"><span className="text-foreground font-sans">Total Estimate:</span><span className="text-secondary">₹{overall}</span></div>
          </div>

          {/* Signature Grid */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold text-foreground block">Customer Digital Signature</span>
            {!isSignCaptured ? (
              <div 
                onClick={() => setIsSignCaptured(true)}
                className="h-24 bg-card hover:bg-[#0A1224] border border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-1.5 cursor-pointer text-muted-foreground transition-all group"
              >
                <Wrench size={16} className="text-foreground/50 group-hover:text-secondary group-hover:animate-bounce" />
                <span className="text-[11px] text-foreground block font-sans">Click to simulate customer signature trace</span>
              </div>
            ) : (
              <div className="h-24 bg-card border border-secondary/25 rounded-xl relative flex justify-center items-center overflow-hidden">
                {/* SVG mock signature line */}
                <svg className="w-48 h-12 stroke-secondary stroke-2 fill-none animate-pulse">
                  <path d="M10,25 Q30,5 50,25 T90,25 T130,10 T170,25" />
                </svg>
                <button
                  type="button"
                  onClick={() => setIsSignCaptured(false)}
                  className="absolute bottom-1 right-2 text-[9px] text-red-400 hover:text-red-500 cursor-pointer"
                >
                  Clear
                </button>
                <div className="absolute top-1 left-2 text-[8px] bg-card text-[#4ADE80] font-bold px-1.5 py-0.5 rounded border border-[#4ADE80]/30 font-mono">
                  SECURE SIG LOCK
                </div>
              </div>
            )}
          </div>

          <button
            disabled={!isSignCaptured}
            onClick={() => advanceJcChat("Job Card finalized and signature locked ✅", { signature: "MOCK_SIG" }, "COMPLETED")}
            className="w-full py-2.5 bg-[#4ADE80] text-primary-dark text-[13px] font-extrabold rounded-lg cursor-pointer transition-all hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed font-sans uppercase tracking-wide"
          >
            Create Job Card in DMS
          </button>
        </div>
      );
    }

    case "COMPLETED": {
      const activeDemands = jcSession.demands || [];
      const mockCreatedJC = {
        jcNo: "JC26000512",
        dealer: "PREM MOTORS PVT. LTD., GURGAON-2S(NEXA)",
        dealerMapCode: "PMG2S001",
        visitDate: "21-MAY-2026",
        gateIn: "09:42",
        serviceType: jcSession.serviceType,
        techName: "VISHAL ADITYA",
        bay: "BAY-04",
        paymentMode: jcSession.paymentMode || "Card",
        promisedDate: "21-MAY-2026",
        promisedTime: jcSession.promisedDateTime || "06:00 PM",
        customer: {
          name: jcSession.customerName || "Ramesh Sharma",
          mobile1: jcSession.customerMobile || "+91 99110 03322",
          email: jcSession.customerEmail || "ramesh.sharma@nexa.com",
          address: "DLF Phase 3, Cyber City",
          city: "Gurugram",
          regNo: jcSession.regNo || "HR26CW7677",
          vin: "MA3YFDS75K008432",
          model: "MARUTI SWIFT VXi",
        },
        demands: activeDemands.map((d: any, idx: number) => ({ ...d, sno: idx + 1 })),
        labour: activeDemands.filter((d: any) => d.type === 'L').map((d: any, idx: number) => ({
          sno: idx + 1,
          code: d.code,
          desc: d.desc,
          qty: d.qty,
          prnHrs: 1.0,
          billableType: "Billable",
          amount: d.price * d.qty
        })),
        parts: activeDemands.filter((d: any) => d.type === 'P').map((d: any, idx: number) => ({
          sno: idx + 1,
          code: d.code,
          desc: d.desc,
          qty: d.qty,
          price: d.price,
          amount: d.price * d.qty
        })),
        odometer: parseInt(jcSession.odometer || "42500")
      };

      const handlePdfTrig = (act: 'download' | 'print') => {
        // Trigger the globally defined method in App.tsx
        if (typeof (window as any)._triggerJcPdf === "function") {
          (window as any)._triggerJcPdf(mockCreatedJC, act);
        } else {
          alert(`PDF simulated action: ${act}. (Open in new tab to download real PDF file!)`);
        }
      };

      return (
        <div className="mt-3 p-4 bg-card/90 rounded-xl border border-border shadow-xl flex flex-col gap-3 font-sans">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handlePdfTrig('print')}
              className="py-2.5 bg-primary text-primary-foreground text-[12px] font-bold rounded-lg cursor-pointer hover:bg-primary/95 flex items-center justify-center gap-1.5 transition-colors"
            >
              <Eye size={13} /> View / Print JC
            </button>
            <button
              onClick={() => handlePdfTrig('download')}
              className="py-2.5 bg-card border border-border text-foreground text-[12px] font-bold rounded-lg cursor-pointer hover:bg-muted flex items-center justify-center gap-1.5 transition-colors"
            >
              <Download size={13} /> Download File
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-1">
            <button
              onClick={() => alert("Customer cost estimates sent via Nexa SMS and Email ✅")}
              className="py-2 text-[11px] font-bold bg-card/70 border border-border text-muted-foreground hover:text-foreground rounded-lg cursor-pointer text-center"
            >
              📧 Email customer JC
            </button>
            <button
              onClick={() => alert("DMS transaction submitted to OCAS Approvals database queue ✅")}
              className="py-2 text-[11px] font-bold bg-card/70 border border-border text-muted-foreground hover:text-foreground rounded-lg cursor-pointer text-center"
            >
              🔐 Submit to OCAS
            </button>
          </div>

          <button
            onClick={() => alert("Syncing details with Maruti Suzuki Warranty Service Portal ✅")}
            className="w-full py-2 bg-card/50 hover:bg-card text-muted-foreground text-[11px] font-semibold rounded-lg border border-border cursor-pointer text-center"
          >
            🛡️ Open Warranty Portal (Validate images)
          </button>
        </div>
      );
    }

    default:
      return null;
  }
}

function UserBubble({ text, timestamp }: { text: string; timestamp: Date }) {
  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex justify-end">
      <div className="max-w-[70%]">
        <div className="px-4 py-2.5 rounded-2xl rounded-tr-sm bg-primary text-primary-foreground text-[13px] font-sans font-medium">{text}</div>
        <p className="text-right text-[10px] text-muted-foreground mt-1 font-mono">{timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
      </div>
    </motion.div>
  )
}

function BotBubble({ 
  text, 
  panel, 
  onAction, 
  timestamp, 
  initialData,
  isJcStep,
  jcStepCode,
  jcSession,
  setJcSession,
  advanceJcChat
}: { 
  text: string; 
  panel?: PanelType; 
  onAction: (a: PanelType, d?: Record<string, unknown>) => void; 
  timestamp: Date; 
  initialData?: Record<string, unknown>;
  isJcStep?: boolean;
  jcStepCode?: string;
  jcSession?: any;
  setJcSession?: any;
  advanceJcChat?: any;
}) {
  const triggerSpeak = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text.replace(/\*\*/g, ""));
      const voices = window.speechSynthesis.getVoices();
      const englishVoice = voices.find(v => v.lang.includes("en-IN") || v.lang.includes("en-US") || v.lang.includes("en-"));
      if (englishVoice) utterance.voice = englishVoice;
      window.speechSynthesis.speak(utterance);
    }
  };

  const ALL_JC_STEPS = [
    "VIN_SCAN",
    "CONFIRM_VEHICLE",
    "CUSTOMER_DETAILS",
    "ODOMETER",
    "SERVICE_TYPE",
    "DENT_VIDEO",
    "INVENTORY",
    "FITMENTS",
    "TYRE_BATTERY",
    "SERVICE_MENU",
    "DEMANDS_LIST",
    "LABOUR_PARTS",
    "SUMMARY",
    "COMPLETED"
  ];

  const FRIENDLY_STEP_LABELS: Record<string, string> = {
    VIN_SCAN: "Reg/VIN Scan",
    CONFIRM_VEHICLE: "Verify Vehicle",
    CUSTOMER_DETAILS: "Customer Profile",
    ODOMETER: "Odometer Reading",
    SERVICE_TYPE: "Select Services",
    DENT_VIDEO: "AICamera Body Check",
    INVENTORY: "Car Inventory",
    FITMENTS: "Aftermarket Fitments",
    TYRE_BATTERY: "Tyres & Battery",
    SERVICE_MENU: "Menu Preloads",
    DEMANDS_LIST: "Demands & Timeline",
    LABOUR_PARTS: "Labour/Parts Estimates",
    SUMMARY: "Verify & Get Signature",
    COMPLETED: "Job Card Generated"
  };

  return (
    <motion.div initial={{ opacity: 0, x: -25 }} animate={{ opacity: 1, x: 0 }} className="flex gap-3">
      <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 shadow-md flex items-center justify-center shrink-0 mt-1">
        <span className="text-primary font-black font-serif text-[14px]">N</span>
      </div>
      <div className="flex-1 min-w-0 font-sans">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[11px] text-muted-foreground font-sans font-semibold tracking-wider uppercase">NEXA AI ASSISTANT</p>
          <button 
            onClick={triggerSpeak} 
            className="text-muted-foreground hover:text-primary transition-all p-1 hover:bg-card/65 rounded flex items-center gap-1 text-[9px] font-sans uppercase tracking-widest cursor-pointer"
            title="Read out loud"
          >
            <Volume2 size={11} /> Speak
          </button>
        </div>
        <div className="p-4 rounded-2xl rounded-tl-sm bg-card border border-border">
          <div className="text-[13px] text-foreground font-sans leading-relaxed">
            <ReactMarkdown 
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                ul: ({node, ...props}) => <ul className="list-disc pl-4 mb-2 last:mb-0" {...props} />,
                ol: ({node, ...props}) => <ol className="list-decimal pl-4 mb-2 last:mb-0" {...props} />,
                li: ({node, ...props}) => <li className="mb-1" {...props} />,
                strong: ({node, ...props}) => <strong className="font-bold text-foreground" {...props} />,
                a: ({node, ...props}) => <a className="text-primary hover:underline" {...props} />
              }}
            >
              {text}
            </ReactMarkdown>
          </div>
        </div>

        {isJcStep && jcStepCode && (
          <div className="mt-3 bg-card/70 p-3 rounded-xl border border-border font-sans">
            <div className="flex justify-between items-center text-[11px] mb-2 font-sans font-bold uppercase tracking-wider text-muted-foreground">
              <span className="text-primary flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#3D8EF0] animate-pulse" />
                Guided Setup Details
              </span>
              <span className="text-foreground">
                {ALL_JC_STEPS.indexOf(jcStepCode) + 1} of {ALL_JC_STEPS.length} Steps
              </span>
            </div>
            
            <div className="flex gap-1 h-1.5">
              {ALL_JC_STEPS.map((step, idx) => {
                const currentIdx = ALL_JC_STEPS.indexOf(jcStepCode);
                const isDone = idx < currentIdx;
                const isCurrent = idx === currentIdx;
                return (
                  <div 
                    key={step} 
                    className={`flex-1 rounded-sm transition-all duration-300 ${
                      isDone 
                        ? "bg-primary" 
                        : isCurrent 
                          ? "bg-[#3D8EF0] ring-1 ring-[#3D8EF0]/50" 
                          : "bg-card"
                    }`}
                    title={FRIENDLY_STEP_LABELS[step]}
                  />
                );
              })}
            </div>
            
            <div className="flex justify-between items-center mt-2.5 text-[11px] font-sans">
              <span className="text-foreground font-semibold">
                Active Area: <span className="text-primary">{FRIENDLY_STEP_LABELS[jcStepCode] || jcStepCode}</span>
              </span>
              {jcStepCode !== "COMPLETED" && (
                <span className="text-muted-foreground font-mono text-[9px] uppercase">
                  Single Interactive Output
                </span>
              )}
            </div>
          </div>
        )}

        {panel && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ delay: 0.05 }}
            className="mt-3 overflow-hidden rounded-2xl border-2 border-primary/20 bg-card shadow-2xl relative"
          >
            {/* Elegant Header of Output Card */}
            <div className="bg-gradient-to-r from-primary/15 via-card to-transparent border-b border-border/80 py-3.5 px-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                {(() => {
                  const activeItem = NAV_ITEMS.find(n => n.id === panel);
                  const Icon = activeItem?.icon || Activity;
                  return (
                    <div className="p-1.5 rounded-lg bg-primary/20 text-primary">
                      <Icon size={14} className="stroke-[2px]" />
                    </div>
                  );
                })()}
                <span className="text-[12.5px] font-black uppercase tracking-widest text-foreground font-sans">
                  {panel.replace("-", " ")} Workspace Card
                </span>
              </div>
              <span className="text-[9.5px] text-primary bg-primary/10 border border-primary/20 font-mono px-2.5 py-0.5 rounded-full uppercase tracking-wider font-extrabold">
                System Live Panel
              </span>
            </div>

            {/* Panel Area wrapper with controlled padding */}
            <div className="p-4 md:p-5">
              <PanelRenderer panel={panel} onAction={onAction} initialData={initialData} />
            </div>
          </motion.div>
        )}

        {isJcStep && jcStepCode && (
          <div className="flex flex-col gap-2 mt-3">
            <JCChatStepRenderer 
              stepCode={jcStepCode} 
              jcSession={jcSession} 
              setJcSession={setJcSession} 
              advanceJcChat={advanceJcChat} 
              isActive={jcSession?.step === jcStepCode} 
            />
            {jcSession?.step === jcStepCode && jcStepCode !== "VIN_SCAN" && jcStepCode !== "COMPLETED" && (
              <div className="flex justify-start px-0.5 mt-1.5 animate-fade-in">
                <button
                  onClick={() => {
                    const currentIdx = ALL_JC_STEPS.indexOf(jcStepCode);
                    if (currentIdx > 0) {
                      const prevStep = ALL_JC_STEPS[currentIdx - 1];
                      if (advanceJcChat) {
                        advanceJcChat("↩ Return to previous step", {}, prevStep);
                      }
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-muted-foreground hover:text-white bg-card/35 hover:bg-card/70 border border-border hover:border-border rounded-lg transition-all cursor-pointer shadow-md select-none"
                >
                  <ChevronLeft size={13} className="text-muted-foreground" />
                  Back to previous step ({FRIENDLY_STEP_LABELS[ALL_JC_STEPS[ALL_JC_STEPS.indexOf(jcStepCode) - 1]] || ""})
                </button>
              </div>
            )}
          </div>
        )}


        <p className="text-[10px] text-muted-foreground mt-1 font-mono">{timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
      </div>
    </motion.div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 shadow-md flex items-center justify-center shrink-0">
        <span className="text-primary font-black font-serif text-[14px]">N</span>
      </div>
      <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-card border border-border flex items-center gap-1.5">
        {[0, 1, 2].map(i => (
          <motion.div key={i} animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.15 }}
            className="w-1.5 h-1.5 rounded-full bg-primary/60" />
        ))}
      </div>
    </div>
  )
}

// ── Dashboard Tiles Config ────────────────────────────────────────────────────
const DASH_TILES: { panel: PanelType | null; label: string; sublabel: string; icon: typeof Calendar; color: string; count: string; badge?: number }[] = [
  { panel: "appointments", label: "My Appointments", sublabel: "2 arrived · 1 in service", icon: Calendar, color: "#3D8EF0", count: "7 Today", badge: 7 },
  { panel: "all-jobcards", label: "My Jobcards", sublabel: "1 OCAS pending", icon: ClipboardList, color: "#FACC15", count: "6 Active" },
  { panel: "vehicle-history", label: "Vehicle History", sublabel: "Enter Reg No / VIN", icon: Car, color: "#0DCAF0", count: "Search" },
  { panel: "my-calls", label: "My Calls", sublabel: "2 missed today", icon: Phone, color: "#4ADE80", count: "2 Missed" },
  { panel: "tasks", label: "Tasks For Today", sublabel: "2 high priority", icon: CheckSquare, color: "#A78BFA", count: "6 Pending" },
  { panel: "suzuki-connect-form", label: "SUZUKI CONNECT\nRequest Form", sublabel: "Drivable requests", icon: Wifi, color: "#FB923C", count: "Submit" },
  { panel: "suzuki-connect-advice", label: "Suzuki Connect\nDrivable Advice", sublabel: "View recommendations", icon: Lightbulb, color: "#34D399", count: "Advice" },
]

const DASH_STATS = [
  { label: "Appointments", value: "7", icon: Calendar, color: "#3D8EF0", sub: "Today · 2 arrived" },
  { label: "Active JCs", value: "3", icon: FileText, color: "#FACC15", sub: "1 OCAS pending" },
  { label: "Pending Tasks", value: "6", icon: CheckSquare, color: "#A78BFA", sub: "2 high priority" },
  { label: "Unread Alerts", value: "3", icon: Bell, color: "#F87171", sub: "1 urgent" },
]

// ── Mock Data for New Sections ────────────────────────────────────────────────
const UPCOMING_TASKS = [
  { id: 1, task: "Stock Inventory Check", time: "Tomorrow, 09:00 AM", priority: "Medium", status: "Scheduled" },
  { id: 2, task: "Suzuki Connect Training", time: "Wed, 02:30 PM", priority: "Low", status: "Confirmed" },
  { id: 3, task: "Monthly Performance Review", time: "Friday, 11:00 AM", priority: "High", status: "Critical" },
];

const VEHICLES_IN_PROGRESS = [
  { id: 1, reg: "HR26CW7677", status: "Washing", model: "Baleno Alpha", progress: 85, technician: "Rahul S." },
  { id: 2, reg: "DL3CCQ8902", status: "Alignment", model: "Swift ZXI+", progress: 40, technician: "Amit K." },
  { id: 3, reg: "UP16AN4511", status: "Inspection", model: "Grand Vitara", progress: 15, technician: "Vivek J." },
];

const QUICK_ACCESS_ITEMS = [
  { label: "Appointments", icon: Calendar, panel: "appointments", badge: 7 },
  { label: "Job Cards", icon: ClipboardList, panel: "all-jobcards" },
  { label: "Vehicle History", icon: Car, panel: "vehicle-history" },
  { label: "My Calls", icon: Phone, panel: "my-calls", badge: 2 },
  { label: "Open New JC", icon: FileText, panel: "jc-opening" },
  { label: "My Tasks", icon: CheckSquare, panel: "tasks" },
  { label: "Service News", icon: Newspaper, panel: "service-news" },
]

// ── Dashboard View ────────────────────────────────────────────────────────────
function DashboardView({ onTileClick, onReturnToChat, theme, setTheme }: { onTileClick: (panel: PanelType) => void, onReturnToChat: () => void, theme: string, setTheme: (val: string) => void }) {
  const [notifs] = useSharedNotifications();
  const unreadCount = notifs.filter(n => !n.read).length;

  const tiles = [
    { id: "appointments" as PanelType, icon: Calendar, label: "All Appointments", color: "#3D8EF0" },
    { id: "notifications" as PanelType, icon: Bell, label: "My Notifications", color: "#F87171", badge: unreadCount },
    { id: "all-jobcards" as PanelType, icon: ClipboardList, label: "All Jobcards", color: "#FACC15" },

    { id: "my-calls" as PanelType, icon: Phone, label: "All Calls", color: "#4ADE80" },
    { id: "vehicle-history" as PanelType, icon: Car, label: "Vehicle History", color: "#0DCAF0" },
    { id: "tasks" as PanelType, icon: CheckSquare, label: "Tasks For Today", color: "#A78BFA" },
    
    { id: "suzuki-connect-form" as PanelType, icon: Car, iconBadge: Wifi, label: "Suzuki Connect", color: "#38BDF8" },
    { id: "jc-opening" as PanelType, icon: FileText, label: "Open Job Card", color: "#34D399" },
  ]

  return (
    <div className="flex flex-col h-full bg-transparent overflow-hidden text-foreground relative z-10 w-full">
      
      {/* 1. Header Navigation Bar */}
      <header className="h-[60px] px-6 flex flex-row items-center justify-between shrink-0 bg-transparent border-b border-border/20 backdrop-blur-md z-20">
        <div className="flex items-center">
          <span className="text-[28px] font-serif tracking-[0.4em] text-foreground">NEXA</span>
        </div>
        
        <div className="flex items-center gap-5">
          {/* Search Box */}
          <div className="h-8 w-64 bg-card border border-border rounded-full flex items-center px-3 focus-within:border-primary transition-all">
            <input 
              type="text" 
              placeholder="Scan Reg No/ QR Code" 
              className="bg-transparent border-none outline-none text-[12px] text-foreground w-full"
            />
            <Search size={14} className="text-muted-foreground shrink-0 ml-2" />
          </div>

          <div className="flex items-center gap-4 text-muted-foreground">
            {/* AI Icon (Back to Chat) */}
            <button className="hover:text-foreground transition-colors cursor-pointer flex items-center justify-center border border-muted-foreground rounded-full p-1" title="Back to Chat" onClick={onReturnToChat}>
              <Bot size={16} strokeWidth={1.5} />
            </button>

            {/* Theme Toggle Button */}
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="hover:text-foreground transition-colors cursor-pointer flex items-center justify-center"
              title={`Switch to ${theme === "dark" ? "Light" : "Dark"} Mode`}
            >
              {theme === "dark" ? <Sun size={18} strokeWidth={1.5} className="text-[#FACC15]" /> : <Moon size={18} strokeWidth={1.5} />}
            </button>

            {/* Logout Button */}
            <button
              onClick={() => { localStorage.removeItem("nexa-authenticated"); window.location.reload(); }}
              className="hover:text-[#F87171] transition-colors cursor-pointer flex items-center justify-center"
              title="Log Out"
            >
              <LogOut size={18} strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </header>

      {/* 2. Grid Area */}
      <div className="flex-1 flex flex-col relative z-20">

        <div className="flex-1 flex flex-col justify-center max-w-5xl mx-auto w-full px-8 py-10 relative">
          <div className="grid grid-cols-3 gap-y-20 gap-x-10 h-full place-content-center">
            {tiles.map((t, i) => (
              <motion.button
                key={i}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => onTileClick(t.id)}
                className="flex flex-col items-center justify-center gap-4 p-4 hover:bg-card transition-all rounded-xl relative group w-full"
              >
                <div className="relative group-hover:scale-110 transition-transform duration-300" style={{ color: t.color }}>
                  <t.icon size={44} strokeWidth={1} />
                  {t.iconBadge && (
                    <div className="absolute -top-1 -right-2">
                      <t.iconBadge size={20} strokeWidth={2} />
                    </div>
                  )}
                  {t.badge !== undefined && t.badge > 0 && (
                    <div className="absolute -top-1 -right-2 bg-[#F87171] text-white text-[11px] font-bold w-6 h-6 flex items-center justify-center rounded-xl shadow-md">
                      {t.badge}
                    </div>
                  )}
                </div>
                <div className="text-center">
                  <p className="text-[14px] font-medium text-foreground tracking-wide">{t.label}</p>
                </div>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Bottom Bar: Service News */}
        <div className="bg-transparent border-t border-border/20 backdrop-blur-md p-5 mt-auto relative z-20">
          <div className="flex items-center justify-between mx-4 relative max-w-7xl mx-auto">
            <button 
              onClick={() => onTileClick("service-news")}
              className="px-8 py-3 bg-transparent border border-border text-muted-foreground text-[12px] font-bold tracking-widest hover:bg-muted transition-all cursor-pointer relative z-10 uppercase hover:text-foreground"
            >
              VIEW ALL
            </button>
            <p className="text-muted-foreground text-[12px] font-semibold absolute left-1/2 -translate-x-[50%] flex flex-col items-center gap-2 cursor-pointer hover:text-foreground transition-colors" onClick={() => onTileClick("service-news")}>
              <Car size={32} strokeWidth={1} />
              Service News
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Sidebar Data ──────────────────────────────────────────────────────────────
const CHAT_HISTORY = [
  { id: "h1", label: "JC opening for HR26CW7677 Baleno", section: "Today", chatType: "work" },
  { id: "h2", label: "Vehicle history – DL6CR1517", section: "Today", chatType: "work" },
  { id: "h3", label: "OCAS approval for JH10CK2349", section: "Yesterday", chatType: "work" },
  { id: "h4", label: "Customer follow-up task list", section: "Yesterday", chatType: "work" },
  { id: "h5", label: "PMS schedule – June 2026 update", section: "7 Days", chatType: "work" },
  { id: "h6", label: "Battery OCAS – Rahul Mehta Baleno", section: "7 Days", chatType: "work" },
  { id: "h7", label: "Jimny campaign inspection list", section: "7 Days", chatType: "work" },
  { id: "he1", label: "My appointments & schedule today", section: "Today", chatType: "employee" },
  { id: "he2", label: "Steps to open a new Job Card", section: "Today", chatType: "employee" },
  { id: "he3", label: "How to process customer callbacks", section: "Yesterday", chatType: "employee" },
]

const NAV_ITEMS: { id: PanelType; icon: typeof Calendar; label: string; badge?: number }[] = [
  { id: "appointments", icon: Calendar, label: "Appointments", badge: 7 },
  { id: "all-jobcards", icon: ClipboardList, label: "Job Cards" },
  { id: "vehicle-history", icon: Car, label: "Vehicle History" },
  { id: "my-calls", icon: Phone, label: "My Calls", badge: 2 },
  { id: "jc-opening", icon: FileText, label: "Open New JC" },
  { id: "tasks", icon: CheckSquare, label: "My Tasks" },
  { id: "service-news", icon: Newspaper, label: "Service News" },
]

// ── Sidebar ────────────────────────────────────────────────────────────────────
function Sidebar({ 
  onNav, 
  onNewChat, 
  setSidebarOpen,
  history,
  activeSessionId,
  onSelectSession,
  onRenameSession,
  onDeleteSession,
  activeChatType,
  onChangeChatType,
  jcSession,
  onGoDashboard
}: {
  onNav: (id: PanelType) => void
  onNewChat: () => void
  setSidebarOpen: (v: boolean) => void
  history: { id: string; label: string; section: string; isDb?: boolean; chatType?: "work" | "employee" }[]
  activeSessionId: string | null
  onSelectSession: (id: string) => void
  onRenameSession: (id: string, newLabel: string) => void
  onDeleteSession: (id: string, e: React.MouseEvent) => void
  activeChatType: "work" | "employee"
  onChangeChatType: (type: "work" | "employee") => void
  jcSession?: any
  onGoDashboard?: () => void
}) {
  const [search, setSearch] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState("")
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const sections = ["Today", "Yesterday", "7 Days"]
  const filtered = history
    .filter(h => (h.chatType || "work") === activeChatType)
    .filter(h => h.label.toLowerCase().includes(search.toLowerCase()))
    .filter(h => activeChatType !== "work" || !h.isCompleted || activeSessionId === h.id)

  function startEdit(id: string, label: string, e: React.MouseEvent) {
    e.stopPropagation()
    setEditingId(id)
    setEditingValue(label)
  }

  function commitEdit(id: string) {
    const trimmed = editingValue.trim()
    if (trimmed) onRenameSession(id, trimmed)
    setEditingId(null)
  }

  return (
    <div className="w-64 shrink-0 h-full flex flex-col bg-transparent border-r border-border/20 backdrop-blur-md">
      {/* Logo + collapse */}
      <div className="flex items-center justify-between px-6 h-[60px] border-b border-border/20 shrink-0 select-none">
        <div className="flex items-center">
          <span className="text-[24px] font-serif tracking-[0.4em] text-foreground">NEXA</span>
        </div>
        <button onClick={() => setSidebarOpen(false)}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-card/60 transition-colors">
          <ChevronLeft size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-none pb-2">
        {/* New Conversation */}
        <div className="px-3 pt-3 pb-2 shrink-0">
        <button onClick={onNewChat}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-border bg-card/50 hover:bg-card text-[12.5px] font-semibold font-sans text-foreground transition-all group">
          <div className="w-4 h-4 rounded-md bg-primary/20 flex items-center justify-center group-hover:bg-primary/30 transition-colors shrink-0">
            <Plus size={11} className="text-primary" />
          </div>
          New conversation
        </button>
      </div>

      {/* Search */}
      <div className="px-3 pb-3 shrink-0">
        <div className="relative">
          <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
            className="w-full pl-7 pr-3 py-1.5 text-[12px] bg-card/40 border border-border rounded-lg text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/30 font-sans transition-colors" />
        </div>
      </div>

      {/* Workshop Station section */}
      <div className="px-3 pb-3 shrink-0">
        <p className="px-2 pb-1.5 text-[9.5px] uppercase tracking-widest text-[#F1F5F9]/60 font-sans font-bold">Workshop Station</p>
        <div className="flex flex-col gap-0.5" id="work-chat-modes">
          <button 
            id="work-chat-mode-btn"
            onClick={() => onChangeChatType("work")}
            className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[12.5px] font-sans font-semibold transition-all group ${
              activeChatType === "work" 
                ? "bg-primary/20 text-primary border-l-2 border-primary" 
                : "text-muted-foreground hover:text-foreground hover:bg-card/60"
            }`}>
            <Wrench size={13} className={`shrink-0 ${activeChatType === "work" ? "text-primary shadow-sm" : "text-muted-foreground/70 group-hover:text-primary transition-colors"}`} />
            <span className="flex-1 text-left">Workshop Station</span>
          </button>
          <button 
            id="employee-chat-mode-btn"
            onClick={() => onChangeChatType("employee")}
            className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[12.5px] font-sans font-semibold transition-all group ${
              activeChatType === "employee" 
                ? "bg-primary/20 text-primary border-l-2 border-primary" 
                : "text-muted-foreground hover:text-foreground hover:bg-card/60"
            }`}>
            <User size={13} className={`shrink-0 ${activeChatType === "employee" ? "text-primary" : "text-muted-foreground/70 group-hover:text-primary transition-colors"}`} />
            <span className="flex-1 text-left">Employee Chat</span>
          </button>
        </div>
      </div>

      {/* Quick nav */}
      <div className="px-3 pb-3 shrink-0">
        <p className="px-2 pb-1.5 text-[9.5px] uppercase tracking-widest text-muted-foreground/60 font-sans font-bold">Quick Access</p>
        <div className="flex flex-col gap-0.5">
          {NAV_ITEMS.filter((item) => {
            if (activeChatType === "employee") {
              return ["my-calls", "appointments", "tasks", "service-news"].includes(item.id);
            } else {
              return ["all-jobcards", "vehicle-history", "jc-opening"].includes(item.id);
            }
          }).map(item => (
            <button key={item.id} onClick={() => onNav(item.id)}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[12.5px] text-muted-foreground hover:text-foreground hover:bg-card/60 transition-all font-sans font-semibold group">
              <item.icon size={13} className="shrink-0 text-muted-foreground/70 group-hover:text-primary transition-colors" />
              <span className="flex-1 text-left">{item.label}</span>
              {item.badge && (
                <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-full bg-[#F87171]/15 text-[#F87171] font-sans">{item.badge}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Chat history */}
      <div className="px-3 pt-1 pb-4 shrink-0">
        {sections.map(section => {
          const items = filtered.filter(h => h.section === section)
          if (!items.length) return null
          return (
            <div key={section} className="mb-3">
              <p className="px-2 pb-1.5 pt-1 text-[9.5px] uppercase tracking-widest text-muted-foreground/50 font-sans font-bold">{section}</p>
              <div className="flex flex-col gap-0.5">
                {items.map(h => (
                  <div key={h.id} className={`group relative flex items-center rounded-lg transition-all ${activeSessionId === h.id ? "bg-primary/10 border-l-2 border-primary" : "hover:bg-card/50"}`}>
                    {editingId === h.id ? (
                      <input
                        autoFocus
                        value={editingValue}
                        onChange={e => setEditingValue(e.target.value)}
                        onBlur={() => commitEdit(h.id)}
                        onKeyDown={e => {
                          if (e.key === "Enter") commitEdit(h.id)
                          if (e.key === "Escape") setEditingId(null)
                        }}
                        className="flex-1 px-2.5 py-1.5 text-[12px] bg-card border border-primary/40 rounded-lg text-foreground outline-none font-sans min-w-0"
                      />
                    ) : (
                      <>
                        <button
                          onClick={() => onSelectSession(h.id)}
                          className={`flex-1 text-left px-2.5 py-1.5 text-[12px] font-sans truncate min-w-0 transition-colors ${activeSessionId === h.id ? "text-primary font-bold" : "text-muted-foreground group-hover:text-foreground"}`}>
                          {h.label}
                        </button>
                        {confirmDeleteId === h.id ? (
                          <div className="flex items-center gap-1 shrink-0 mr-1.5 z-10" onClick={e => e.stopPropagation()}>
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                onDeleteSession(h.id, e);
                                setConfirmDeleteId(null);
                              }}
                              className="p-1 rounded-md text-emerald-500 hover:bg-emerald-500/10 transition-all"
                              title="Confirm Delete"
                            >
                              <Check size={11} />
                            </button>
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                setConfirmDeleteId(null);
                              }}
                              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-card/80 transition-all"
                              title="Cancel"
                            >
                              <X size={11} />
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              onClick={e => startEdit(h.id, h.label, e)}
                              className="shrink-0 mr-1 p-1 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all opacity-0 group-hover:opacity-100 transition-opacity">
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </button>
                            {h.isDb && (
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  setConfirmDeleteId(h.id);
                                }}
                                className="shrink-0 mr-1.5 p-1 rounded-md text-muted-foreground hover:text-[#F87171] hover:bg-[#F87171]/10 transition-all opacity-0 group-hover:opacity-100 transition-opacity">
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="3 6 5 6 21 6"></polyline>
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                  <line x1="10" y1="11" x2="10" y2="17"></line>
                                  <line x1="14" y1="11" x2="14" y2="17"></line>
                                </svg>
                              </button>
                            )}
                          </>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
      </div>
    </div>
  )
}

// ── Welcome Screen Component ──────────────────────────────────────────────────
interface WelcomeScreenProps {
  onNavToPanel: (id: PanelType) => void;
  chatType: "work" | "employee";
  theme?: string;
}

function WelcomeScreen({ onNavToPanel, chatType, theme = "light" }: WelcomeScreenProps) {
  const employeeCards = [
    {
      id: "appointments" as PanelType,
      title: "APPOINTMENTS",
      icon: Calendar
    },
    {
      id: "my-calls" as PanelType,
      title: "MY CALLS",
      icon: Phone
    },
    {
      id: "tasks" as PanelType,
      title: "MY TASKS",
      icon: CheckSquare
    },
    {
      id: "service-news" as PanelType,
      title: "SERVICE NEWS",
      icon: Newspaper
    }
  ];

  const workCards = [
    {
      id: "jc-opening" as PanelType,
      title: "OPEN JOB CARD",
      icon: FileText
    },
    {
      id: "vehicle-history" as PanelType,
      title: "VEHICLE HISTORY",
      icon: Car
    },
    {
      id: "suzuki-connect-form" as PanelType,
      title: "SUZUKI CONNECT",
      icon: Wrench
    },
    {
      id: "all-jobcards" as PanelType,
      title: "ACTIVE JOBCARDS",
      icon: ClipboardList
    }
  ];

  const cards = chatType === "work" ? workCards : employeeCards;

  return (
    <div className="flex-1 px-6 py-10 md:py-16 flex flex-col justify-center items-center select-none w-full max-w-4xl mx-auto scrollbar-none animate-fade-in">
      {/* Centered Glowing Orb */}
      <div className="relative w-32 h-32 flex items-center justify-center mb-6">
        {/* Ambient Pulsing Glow behind the orb */}
        <div className={`absolute w-24 h-24 rounded-full blur-3xl opacity-50 transition-all duration-700 animate-pulse ${
          theme === "dark" 
            ? "bg-white/30" 
            : "bg-violet-500/30"
        }`} />
        
        {/* Core solid styled orb */}
        <div className={`w-[60px] h-[60px] rounded-full flex items-center justify-center transition-all duration-500 relative z-10 ${
          theme === "dark"
            ? "bg-white shadow-[0_0_45px_15px_rgba(255,255,255,0.4)] border-[5px] border-black"
            : "bg-[#7c3aed] shadow-[0_0_40px_15px_rgba(124,58,237,0.35)]"
        }`}>
          {theme === "dark" && (
            <div className="w-4 h-4 rounded-full bg-black" />
          )}
        </div>
      </div>

      {/* Main greeting header matching the screenshot */}
      <h2 className={`text-[26px] sm:text-[32px] font-extrabold tracking-tight text-center mb-8 font-sans transition-colors duration-500 ${
        theme === "dark" ? "text-white" : "text-[#000000]"
      }`}>
        How can I assist you today?
      </h2>

      {/* Sugestion Pill buttons matching screenshot precisely */}
      <div className="flex flex-wrap justify-center gap-4 w-full max-w-3xl">
        {cards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <motion.button
              key={card.id || idx}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.05, duration: 0.25 }}
              onClick={() => onNavToPanel(card.id)}
              className={`group flex items-center justify-center gap-3 px-6 py-3.5 rounded-[22px] border transition-all duration-300 cursor-pointer shadow-sm hover:shadow-md hover:-translate-y-0.5 ${
                theme === "dark"
                  ? "bg-black border-zinc-800 text-white hover:bg-zinc-950 hover:border-zinc-700"
                  : "bg-white border-[#eaecef] text-[#000000] hover:border-violet-300/80 hover:bg-neutral-50"
              }`}
            >
              <Icon size={16} strokeWidth={2.5} className={`transition-colors duration-300 ${
                theme === "dark" ? "text-white group-hover:text-zinc-300" : "text-[#7c3aed]"
              }`} />
              <span className="text-[12px] font-extrabold tracking-wider uppercase font-sans">
                {card.title}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

// ── Login Screen ─────────────────────────────────────────────────────────────
interface LoginScreenProps {
  onLoginSuccess: () => void;
  theme: "light" | "dark";
  setTheme: (t: "light" | "dark") => void;
}

function LoginScreen({ onLoginSuccess, theme, setTheme }: LoginScreenProps) {
  const [userId, setUserId] = useState("Nexa123345")
  const [password, setPassword] = useState("XXXXXXXXXX")

  return (
    <div 
      className={`flex h-screen w-full overflow-hidden transition-colors duration-500 relative ${
        theme === "dark" ? "bg-[#050505] text-neutral-100" : "bg-[#f8f9fa] text-[#0a0a0d]"
      }`}
      style={{
        backgroundImage: theme === "dark" 
          ? 'radial-gradient(ellipse at 50% -20%, rgba(30, 40, 60, 0.35), transparent 70%)' 
          : 'none'
      }}
    >
      {/* Subtle stripe pattern background overlay for dark theme */}
      {theme === "dark" && (
        <div 
          className="absolute inset-0 z-0 opacity-10 pointer-events-none" 
          style={{ backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 4px, rgba(255,255,255,0.05) 4px, rgba(255,255,255,0.05) 8px)' }}
        />
      )}

      {/* Left side panel: NEXA wide serif logo and version log */}
      <div 
        className={`w-[43%] hidden md:flex flex-col justify-center items-center border-r relative select-none h-full shrink-0 z-10 transition-all duration-500 ${
          theme === "dark" 
            ? "bg-[#0c0c0e] border-[#1f1f23]" 
            : "bg-[#f8f9fa] border-[#e4e4e7]"
        }`}
      >
        <h1 className={`text-[64px] font-[200] tracking-[0.55em] uppercase font-serif pl-[0.55em] drop-shadow-sm transition-colors duration-500 ${
          theme === "dark" ? "text-white" : "text-black"
        }`}>
          NEXA
        </h1>
        <div className={`absolute bottom-6 left-10 text-[11px] font-[500] tracking-wider flex gap-5 font-sans uppercase transition-colors duration-500 ${
          theme === "dark" ? "text-zinc-500" : "text-zinc-650"
        }`}>
          <span>Version : 16.4</span>
          <span className={theme === "dark" ? "text-zinc-800" : "text-zinc-300"}>|</span>
          <span>Mode: LIVE</span>
        </div>
      </div>

      {/* Right side panel: Login action container */}
      <div 
        className={`flex-1 flex flex-col justify-center items-center p-8 md:p-16 relative h-full min-w-0 z-10 transition-all duration-500 ${
          theme === "dark" ? "bg-[#050505]" : "bg-white"
        }`}
      >
        {/* Top Header */}
        <div className="absolute top-6 right-10 flex items-center gap-6 z-20">
          <span className={`text-[11px] font-sans select-none hidden sm:inline transition-colors duration-500 ${
            theme === "dark" ? "text-zinc-500" : "text-zinc-550"
          }`}>
            Designed & Developed by <span className="font-bold text-[#F26522]">global360</span>
          </span>
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className={`w-8 h-8 rounded-full border flex items-center justify-center bg-transparent transition-all duration-300 cursor-pointer shadow-sm ${
              theme === "dark" 
                ? "border-zinc-800 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100" 
                : "border-[#e4e4e7] text-zinc-600 hover:bg-neutral-100 hover:text-black"
            }`}
            title={`Switch to ${theme === "dark" ? "Light" : "Dark"} Mode`}
          >
            {theme === "dark" ? <Sun size={15} className="text-[#FACC15]" /> : <Moon size={15} />}
          </button>
        </div>

        {/* Profile Avatar */}
        <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-8 border shadow-sm transition-all hover:scale-[1.03] duration-500 ${
          theme === "dark" 
            ? "bg-[#0c0c0e] border-zinc-800/80 text-zinc-300" 
            : "bg-white border-neutral-350 text-black"
        }`}>
          <User size={38} className={`transition-colors duration-500 ${theme === "dark" ? "text-zinc-300" : "text-black"}`} strokeWidth={1.5} />
        </div>

        {/* Form elements */}
        <div className="w-full max-w-sm space-y-5">
          <div className="space-y-1.5">
            <label className={`block text-[12.5px] font-[600] ml-1 font-sans tracking-wide transition-colors duration-500 ${
              theme === "dark" ? "text-zinc-400" : "text-zinc-700"
            }`}>
              User ID
            </label>
            <input 
              type="text" 
              value={userId} 
              onChange={e => setUserId(e.target.value)}
              className={`w-full px-4 py-3 border rounded-xl outline-none text-[14px] font-sans transition-all font-semibold shadow-sm focus:ring-1 ${
                theme === "dark" 
                  ? "bg-[#0c0c0e] border-zinc-800 text-white focus:border-zinc-600 focus:ring-zinc-700" 
                  : "bg-white border-neutral-350 text-black focus:border-[#7c3aed] focus:ring-[#7c3aed]/10"
              }`} 
            />
          </div>
          <div className="space-y-1.5">
            <label className={`block text-[12.5px] font-[600] ml-1 font-sans tracking-wide transition-colors duration-500 ${
              theme === "dark" ? "text-zinc-400" : "text-zinc-700"
            }`}>
              Password
            </label>
            <input 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)}
              className={`w-full px-4 py-3 border rounded-xl outline-none text-[14px] font-sans transition-all font-semibold shadow-sm focus:ring-1 ${
                theme === "dark" 
                  ? "bg-[#0c0c0e] border-zinc-800 text-white focus:border-zinc-600 focus:ring-zinc-700" 
                  : "bg-white border-neutral-350 text-black focus:border-[#7c3aed] focus:ring-[#7c3aed]/10"
              }`} 
            />
          </div>
          <button 
            onClick={onLoginSuccess}
            className={`w-full font-bold py-3.5 px-6 rounded-full text-[12.5px] tracking-[0.2em] uppercase transition-all shadow-md active:scale-95 cursor-pointer mt-2 ${
              theme === "dark" 
                ? "bg-white text-black hover:bg-neutral-100" 
                : "bg-black text-white hover:bg-neutral-800"
            }`}
          >
            LOGIN
          </button>
        </div>

        {/* Brand identity footer */}
        <div className={`absolute bottom-6 right-10 text-[10.5px] font-mono tracking-tight select-none transition-colors duration-500 ${
          theme === "dark" ? "text-zinc-705" : "text-neutral-400"
        }`}>
          UDID: 4B8CF526-786D-4B0B-9383-626BA7062213
        </div>
      </div>
    </div>
  )
}


export default function App() {
  const [authenticated, setAuthenticated] = useState(() => localStorage.getItem("nexa-authenticated") === "true")

  useEffect(() => {
    localStorage.setItem("nexa-authenticated", authenticated.toString())
  }, [authenticated])
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [view, setView] = useState<"dashboard" | "chat">("chat")
  const [activeDashPanel, setActiveDashPanel] = useState<PanelType | null>(null)
  const [activeDashPanelData, setActiveDashPanelData] = useState<Record<string, unknown> | undefined>(undefined)
  const [sharedNotifs, setSharedNotifs] = useSharedNotifications()
  
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const activeSessionIdRef = useRef<string | null>(null)
  const [activeChatType, setActiveChatType] = useState<"work" | "employee">("work")
  const [activeWorkPanel, setActiveWorkPanel] = useState<PanelType | null>(null)
  const [activeWorkPanelData, setActiveWorkPanelData] = useState<Record<string, unknown> | undefined>(undefined)
  const [showNewChatModal, setShowNewChatModal] = useState(false)
  
  const updateActiveSessionId = (id: string | null) => {
    setActiveSessionId(id)
    activeSessionIdRef.current = id
  }

  const [loadingChat, setLoadingChat] = useState(false)
  const [dbSessions, setDbSessions] = useState<any[]>([])

  async function refreshSessionsList() {
    try {
      const realSessions = await fetchChatSessions()
      setDbSessions(realSessions)
    } catch (err) {
      console.error("Failed to load chat history sessions:", err)
    }
  }

  // Reload real chat sessions on startup or when authenticated
  useEffect(() => {
    async function initFirebaseAndLoad() {
      if (isFirebaseEnabled()) {
        try {
          await ensureAuth()
        } catch (err) {
          console.error("Firebase init failed:", err)
        }
      }
      // Always reload sessions from our unified persistence layer
      await refreshSessionsList()
    }
    initFirebaseAndLoad()
  }, [authenticated])

  // Helper to persist a single message to Firestore during active runtime sessions
  async function persistMessage(msg: Message, customSessionLabel?: string) {
    try {
      let currentSessId = activeSessionIdRef.current
      const isJcCompleted = msg.jcStepCode === "COMPLETED" || (jcSession && jcSession.step === "COMPLETED");
      if (!currentSessId) {
        // Create new session ID
        currentSessId = "sess_" + Date.now().toString()
        activeSessionIdRef.current = currentSessId
        updateActiveSessionId(currentSessId)
        
        // Define label from message text
        const labelText = customSessionLabel || msg.text || "New Conversation"
        await saveChatSession(currentSessId, labelText, activeChatType, isJcCompleted)
        await refreshSessionsList()
      }
      
      // Save message document inside subcollection
      await saveChatMessage(currentSessId, msg)
    } catch (err) {
      console.error("Failed to save session/message persistence:", err)
    }
  }

  async function handleSelectSession(sessId: string) {
    setLoadingChat(true)
    setView("chat")
    updateActiveSessionId(sessId)
    
    // Clear active temporary standalone panel states
    setActiveWorkPanel(null)
    setActiveWorkPanelData(undefined)
    setActiveDashPanel(null)
    setActiveDashPanelData(undefined)
    
    const dbSess = dbSessions.find(s => s.id === sessId)
    if (dbSess) {
      setActiveChatType(dbSess.chatType || "work")
    } else {
      const staticSess = CHAT_HISTORY.find(h => h.id === sessId)
      if (staticSess) {
        setActiveChatType(staticSess.chatType || "work")
      }
    }

    try {
      const msgs = await fetchChatMessages(sessId)
      setMessages(msgs)
      
      // Auto-restore where they left off
      const jcSteps = msgs.filter(m => m.isJcStep && m.jcStepCode)
      if (jcSteps.length > 0) {
        const lastJcMsg = jcSteps[jcSteps.length - 1]
        if (lastJcMsg.initialData) {
          setJcSession(lastJcMsg.initialData as any)
        } else {
          setJcSession({
            step: lastJcMsg.jcStepCode as any,
            regNo: "DL6CR1517",
            customerName: "Ramesh Sharma",
            customerMobile: "9812345678",
            customerEmail: "ramesh.sharma@nexa.com",
            odometer: "42500",
            serviceType: "PMS",
            subServiceType: "PMS-Standard",
            isCng: false,
            fuelLevel: "1/2",
            dents: [],
            interiorImages: [],
            inventory: { spareTyre: 1, jackWrench: 1, floorMats: 4, umbrella: 1 },
            fitments: [],
            tyreHealth: { fl: 4, fr: 4, rl: 4, rr: 4, spare: 4 },
            batteryHealth: "Good",
            demands: [
              { id: "1", desc: "Engine Oil Change", code: "LOC001", type: "L" as const, qty: 1, price: 350, addedBy: "service_menu" },
              { id: "2", desc: "Oil Filter", code: "68510-68L10", type: "P" as const, qty: 1, price: 285, addedBy: "service_menu" },
              { id: "3", desc: "Air Filter Check", code: "68510-79J00", type: "P" as const, qty: 1, price: 540, addedBy: "service_menu" }
            ],
            promisedDateTime: "Tomorrow 5 PM",
            paymentMode: "Card",
          })
        }
      } else {
        setJcSession(null)
      }

      const panelMsgs = msgs.filter(m => m.panel)
      if (panelMsgs.length > 0) {
        const lastPanelMsg = panelMsgs[panelMsgs.length - 1]
        setActiveDashPanel(lastPanelMsg.panel)
        if (lastPanelMsg.initialData) {
          setActiveDashPanelData(lastPanelMsg.initialData as any)
        }
      } else {
        setActiveDashPanel(null)
        setActiveDashPanelData(undefined)
      }
    } catch (err) {
      console.error("Failed to load conversation messages:", err)
    } finally {
      setLoadingChat(false)
    }
  }

  async function handleDeleteSession(sessId: string, e: React.MouseEvent) {
    e.stopPropagation()
    try {
      await deleteChatSession(sessId)
      if (activeSessionId === sessId) {
        handleNewChat()
      }
      refreshSessionsList()
    } catch (err) {
      console.error("Failed to delete chat session from Firestore:", err)
    }
  }

  async function handleRenameSession(sessId: string, newLabel: string) {
    try {
          const existingSess = dbSessions.find(s => s.id === sessId)
          await saveChatSession(sessId, newLabel, existingSess?.chatType || "work")
          refreshSessionsList()
    } catch (err) {
      console.error("Failed to rename chat session inside Firestore:", err)
    }
  }
  const [input, setInput] = useState("")
  const [typing, setTyping] = useState(false)
  const [attachedFile, setAttachedFile] = useState<{name: string, type: 'image' | 'pdf' | 'other'} | null>(null)
  const [isScanningInChat, setIsScanningInChat] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const chatRef = useRef<HTMLDivElement>(null)
  const [jcSession, setJcSession] = useState<{
    step: "VIN_SCAN" | "CONFIRM_VEHICLE" | "CUSTOMER_DETAILS" | "ODOMETER" | "SERVICE_TYPE" | "DENT_VIDEO" | "INVENTORY" | "FITMENTS" | "TYRE_BATTERY" | "SERVICE_MENU" | "DEMANDS_LIST" | "LABOUR_PARTS" | "SUMMARY" | "COMPLETED";
    regNo: string;
    customerName: string;
    customerMobile: string;
    customerEmail: string;
    odometer: string;
    serviceType: string;
    subServiceType: string;
    isCng: boolean;
    fuelLevel: string;
    dents: { id: string; zone: string; type: string; severity: string; confidence: number; frame_image_url?: string }[];
    interiorImages: string[];
    inventory: { spareTyre: number; jackWrench: number; floorMats: number; umbrella: number };
    fitments: string[];
    tyreHealth: { fl: number; fr: number; rl: number; rr: number; spare: number };
    batteryHealth: string;
    demands: { id: string; desc: string; addedBy: string; code: string; type: "L" | "P"; qty: number; price: number }[];
    promisedDateTime: string;
    paymentMode: string;
    signature?: string;
  } | null>(null)
  const [isListening, setIsListening] = useState(false)
  const [isVoiceHUDOpen, setIsVoiceHUDOpen] = useState(false)
  const [speakResponses, setSpeakResponses] = useState(false)
  const [interimText, setInterimText] = useState("")
  const [speechError, setSpeechError] = useState<string | null>(null)
  const recognitionRef = useRef<any>(null)
  
  const [theme, setTheme] = useState<"light" | "dark">(() => (localStorage.getItem("nexa-theme") as "light" | "dark") || "light")

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
    localStorage.setItem("nexa-theme", theme)
  }, [theme])

  useEffect(() => {
    // Initialize Speech Recognition natively in-browser
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (SpeechRecognition) {
      const rec = new SpeechRecognition()
      rec.continuous = false
      rec.interimResults = true
      rec.lang = 'en-IN' // Tailored for Indian region pronunciation (Maruti Suzuki NEXA)

      rec.onstart = () => {
        setIsListening(true)
        setIsVoiceHUDOpen(true)
        setSpeechError(null)
        setInterimText("Listening for NEXA command...")
      }

      rec.onresult = (event: any) => {
        let interimTranscript = ""
        let finalTranscript = ""

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript
          } else {
            interimTranscript += event.results[i][0].transcript
          }
        }

        if (finalTranscript) {
          setInput(finalTranscript)
          handleSendVoice(finalTranscript)
          setInterimText("")
        } else {
          setInterimText(interimTranscript || "Transcribing...")
        }
      }

      rec.onerror = (event: any) => {
        console.error("Speech Recognition Error:", event.error)
        setIsListening(false)
        if (event.error === 'not-allowed') {
          setSpeechError(
            "Microphone blocked: Browser iframe standards require top-level focus. " +
            "To activate actual physical microphone capture, click the 'Open in new tab' button at top-right. " +
            "Alternatively, use our instant hands-free simulation dashboard triggers below!"
          )
        } else if (event.error === 'no-speech') {
          setSpeechError("No voice detected. Please click Simulated Triggers below or speak closer to your microphone.")
        } else {
          setSpeechError(`Voice status error: ${event.error}`)
        }
      }

      rec.onend = () => {
        setIsListening(false)
      }

      recognitionRef.current = rec
    } else {
      setSpeechError("Web Speech API is not supported on this browser context. Please use our HUD Voice Emulator below.")
    }
  }, [])
  
  const unreadCount = sharedNotifs.filter(n => !n.read).length



  async function startChatJCOpening(regInput = "") {
    const initialSession = {
      step: (regInput ? "CONFIRM_VEHICLE" : "VIN_SCAN") as any,
      regNo: regInput,
      customerName: "Ramesh Sharma",
      customerMobile: "9812345678",
      customerEmail: "ramesh.sharma@nexa.com",
      odometer: "42500",
      serviceType: "PMS",
      subServiceType: "PMS-Standard",
      isCng: false,
      fuelLevel: "1/2",
      dents: [] as { id: string; zone: string; type: string; severity: string; confidence: number; frame_image_url?: string }[],
      interiorImages: [] as string[],
      inventory: { spareTyre: 1, jackWrench: 1, floorMats: 4, umbrella: 1 },
      fitments: [] as string[],
      tyreHealth: { fl: 4, fr: 4, rl: 4, rr: 4, spare: 4 },
      batteryHealth: "Good",
      demands: [
        { id: "1", desc: "Engine Oil Change", code: "LOC001", type: "L" as const, qty: 1, price: 350, addedBy: "service_menu" },
        { id: "2", desc: "Oil Filter", code: "68510-68L10", type: "P" as const, qty: 1, price: 285, addedBy: "service_menu" },
        { id: "3", desc: "Air Filter Check", code: "68510-79J00", type: "P" as const, qty: 1, price: 540, addedBy: "service_menu" }
      ],
      promisedDateTime: "Tomorrow 5 PM",
      paymentMode: "Card",
    };
    
    // Assign session ID immediately to transition UI smoothly
    const localSessId = "sess_local_" + Date.now().toString();
    activeSessionIdRef.current = localSessId;
    updateActiveSessionId(localSessId);
    
    await saveChatSession(localSessId, "Job Card Setup: " + (regInput || "New"), activeChatType, false);
    await refreshSessionsList();

    setJcSession(initialSession);
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      const text = regInput 
        ? `Initiating guided Job Card setup workflow for vehicle **${regInput}**. Advancing to Step 1: Customer & Vehicle Details...`
        : `Let's open a new Job Card. Please scan or type the vehicle's Registration Number or VIN.`;
      
      const msg: Message = {
        id: Date.now().toString(),
        role: "bot",
        text,
        isJcStep: true,
        jcStepCode: regInput ? "CONFIRM_VEHICLE" : "VIN_SCAN",
        initialData: initialSession,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, msg]);
      persistMessage(msg);
    }, 500);
  }

  function advanceJcChat(userSelectionText: string, updatedFields: Partial<typeof jcSession> = {}, nextStep: any) {
    const currentSess = jcSession || {
      step: "VIN_SCAN" as const,
      regNo: "DL6CR1517",
      customerName: "Ramesh Sharma",
      customerMobile: "9812345678",
      customerEmail: "ramesh.sharma@nexa.com",
      odometer: "42500",
      serviceType: "PMS",
      subServiceType: "PMS-Standard",
      isCng: false,
      fuelLevel: "1/2",
      dents: [],
      interiorImages: [],
      inventory: { spareTyre: 1, jackWrench: 1, floorMats: 4, umbrella: 1 },
      fitments: [],
      tyreHealth: { fl: 4, fr: 4, rl: 4, rr: 4, spare: 4 },
      batteryHealth: "Good",
      demands: [
        { id: "1", desc: "Engine Oil Change", code: "LOC001", type: "L" as const, qty: 1, price: 350, addedBy: "service_menu" },
        { id: "2", desc: "Oil Filter", code: "68510-68L10", type: "P" as const, qty: 1, price: 285, addedBy: "service_menu" },
        { id: "3", desc: "Air Filter Check", code: "68510-79J00", type: "P" as const, qty: 1, price: 540, addedBy: "service_menu" }
      ],
      promisedDateTime: "Tomorrow 5 PM",
      paymentMode: "Card",
    };

    const nextSess = {
      ...currentSess,
      ...updatedFields,
      step: nextStep
    };
    
    setJcSession(nextSess);
    setTyping(true);
    
    let nextText = "";
    if (nextStep === "VIN_SCAN") {
      nextText = `Let's open a new Suzuki Nexa Job Card! Please scan the vehicle's registration plate or enter details below to begin:`;
    } else if (nextStep === "CONFIRM_VEHICLE") {
      nextText = `Got it — **${nextSess.regNo}**. Fetching vehicle details from DMS... ✅\n\nFound: **2022 Maruti Suzuki Swift VXi** | VIN: **MA3EWDE1S00XXXXX**\nIs this correct?`;
    } else if (nextStep === "CUSTOMER_DETAILS") {
      nextText = `Here are the customer details fetched from DMS:\n👤 **Ramesh Sharma** | 📞 **${nextSess.customerMobile}** | ✉️ **${nextSess.customerEmail}**\n\nPlease confirm if these details are correct or edit them:`;
    } else if (nextStep === "ODOMETER") {
      nextText = `What is the vehicle's current odometer reading?`;
    } else if (nextStep === "SERVICE_TYPE") {
      nextText = `Please select the primary service type and CNG flag:`;
    } else if (nextStep === "DENT_VIDEO") {
      nextText = `Let's capture the vehicle condition. You can upload a short walkround video for AI scratch & dent detection, or mark spots manually on the diagram:`;
    } else if (nextStep === "INVENTORY") {
      nextText = `Let's record the vehicle inventory items. Please adjust quantities of standard items inside the car:`;
    } else if (nextStep === "FITMENTS") {
      nextText = `Are there any unapproved or non-OEM aftermarket fitments on the vehicle?`;
    } else if (nextStep === "TYRE_BATTERY") {
      nextText = `Please rate the tyre health for each tyre of the vehicle (1 = Worn, 5 = New), and specify battery condition:`;
    } else if (nextStep === "SERVICE_MENU") {
      nextText = `Service Type is **${nextSess.serviceType}**. Standard service menu matching this type has been loaded. Confirm or customize items:`;
    } else if (nextStep === "DEMANDS_LIST") {
      nextText = `Review your active job demands list. You can add voice records, set promised delivery timing, and confirm payment mode:`;
    } else if (nextStep === "LABOUR_PARTS") {
      nextText = `Add labour and parts to the Job Card. Search/select from the frequent list below:`;
    } else if (nextStep === "SUMMARY") {
      nextText = `📋 **Job Card Summary — Please Review**: All fields are logged. Please collect customer digital signature and submit to create the Job Card.`;
    } else if (nextStep === "COMPLETED") {
      nextText = `🎉 **Job Card Created Successfully!**\n\n**Job Card Number:** JC-2026-78432\n\nCustomer approval estimates (OCAS) has been compiled. What would you like to do next?`;
    }
    
    setTimeout(() => {
      setTyping(false);
      
      const jcMsgIdx = [...messages].reverse().findIndex(m => m.isJcStep);
      if (jcMsgIdx !== -1) {
        const actualIndex = messages.length - 1 - jcMsgIdx;
        const updatedMsg = {
          ...messages[actualIndex],
          text: nextText,
          jcStepCode: nextStep,
          initialData: nextSess,
          timestamp: new Date()
        };
        
        setMessages(prev => {
          const idx = [...prev].reverse().findIndex(m => m.isJcStep);
          if (idx !== -1) {
            const actIdx = prev.length - 1 - idx;
            const updated = [...prev];
            updated[actIdx] = updatedMsg;
            return updated;
          }
          return [...prev, updatedMsg];
        });
        
        persistMessage(updatedMsg);
      } else {
        const newMsg: Message = {
          id: Date.now().toString(),
          role: "bot",
          text: nextText,
          isJcStep: true,
          jcStepCode: nextStep,
          initialData: nextSess,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, newMsg]);
        persistMessage(newMsg);
      }
    }, 400);
  }

  // Speech Assistant States
  useEffect(() => {
    // Initialize Speech Recognition natively in-browser
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (SpeechRecognition) {
      const rec = new SpeechRecognition()
      rec.continuous = false
      rec.interimResults = true
      rec.lang = 'en-IN' // Tailored for Indian region pronunciation (Maruti Suzuki NEXA)

      rec.onstart = () => {
        setIsListening(true)
        setIsVoiceHUDOpen(true)
        setSpeechError(null)
        setInterimText("Listening for NEXA command...")
      }

      rec.onresult = (event: any) => {
        let interimTranscript = ""
        let finalTranscript = ""

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript
          } else {
            interimTranscript += event.results[i][0].transcript
          }
        }

        if (finalTranscript) {
          setInput(finalTranscript)
          handleSendVoice(finalTranscript)
          setInterimText("")
        } else {
          setInterimText(interimTranscript || "Transcribing...")
        }
      }

      rec.onerror = (event: any) => {
        console.error("Speech Recognition Error:", event.error)
        setIsListening(false)
        if (event.error === 'not-allowed') {
          setSpeechError(
            "Microphone blocked: Browser iframe standards require top-level focus. " +
            "To activate actual physical microphone capture, click the 'Open in new tab' button at top-right. " +
            "Alternatively, use our instant hands-free simulation dashboard triggers below!"
          )
        } else if (event.error === 'no-speech') {
          setSpeechError("No voice detected. Please click Simulated Triggers below or speak closer to your microphone.")
        } else {
          setSpeechError(`Voice status error: ${event.error}`)
        }
      }

      rec.onend = () => {
        setIsListening(false)
      }

      recognitionRef.current = rec
    } else {
      setSpeechError("Web Speech API is not supported on this browser context. Please use our HUD Voice Emulator below.")
    }
  }, [])

  const toggleListening = () => {
    setSpeakResponses(true)
    const nextHUDOpen = !isVoiceHUDOpen
    setIsVoiceHUDOpen(nextHUDOpen)
    
    if (!recognitionRef.current) {
      // Toggle simulated overlay
      setIsListening(nextHUDOpen)
      setSpeechError("Browser iframe sandboxed. Activating NEXA OCR & HUD Voice Emulator.")
      return
    }
    
    setSpeechError(null)
    if (nextHUDOpen) {
      try {
        recognitionRef.current.start()
      } catch (e) {
        console.error(e)
        // Recover state
        try { recognitionRef.current.stop() } catch(_) {}
        setTimeout(() => {
          try { recognitionRef.current.start() } catch(err) {
            console.error("Failed to recover voice start:", err)
            setSpeechError(
              "Sandbox constraints detected. Open this app in a New Tab to grant microphone access, " +
              "or click the simulation toggles below to execute vocal flows instantly!"
            )
          }
        }, 100)
      }
    } else {
      try {
        recognitionRef.current.stop()
      } catch (e) {
        console.error(e)
      }
      setIsListening(false)
    }
  }

  const speakText = (text: string) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.05;
    
    const voices = window.speechSynthesis.getVoices();
    const desiredVoice = voices.find(v => v.lang.includes("en-IN") || v.lang.includes("en-US") || v.lang.includes("en-"));
    if (desiredVoice) utterance.voice = desiredVoice;
    
    window.speechSynthesis.speak(utterance);
  }

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [messages, typing])

  function addUserMessage(text: string) {
    const msg: Message = { id: Date.now().toString(), role: "user", text, timestamp: new Date() }
    setMessages(prev => [...prev, msg])
    persistMessage(msg)
  }

  function addBotMessageSync(text: string, panel?: PanelType, initialData?: Record<string, unknown>) {
    const msg: Message = {
      id: (Date.now() + 1).toString(), role: "bot", text, panel, initialData,
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, msg])
    persistMessage(msg)
  }

  async function handleSendVoice(text: string) {
    if (!text.trim()) return
    addUserMessage(text)
    setTyping(true)
    await processChatMessage(text.trim())
  }

  async function processChatMessage(trimmed: string) {
    const upperText = trimmed.toUpperCase();
    
    // Check if user is asking to add or open a job card
    if (
      upperText.includes("ADD JOB CARD") || 
      upperText.includes("OPEN JOB CARD") || 
      upperText.includes("NEW JOB CARD") || 
      upperText.includes("CREATE JOB CARD") || 
      upperText.includes("ADD JC") || 
      upperText.includes("OPEN JC") ||
      upperText.includes("JOB CARD PROCESS")
    ) {
      // Find reg number inside prompt
      const regMatch = trimmed.match(/[A-Za-z]{2}\d{1,2}[A-Za-z]{1,2}\d{4}/) || trimmed.match(/DL6CR1517/i) || trimmed.match(/HR26DS6144/i) || trimmed.match(/HR26CW7677/i);
      const regNoVal = regMatch ? regMatch[0].toUpperCase() : "";
      
      startChatJCOpening(regNoVal);
      return;
    }

    // Check if user is asking for vehicle history
    if (
      upperText.includes("VEHICLE HISTORY") || 
      upperText.includes("CAR HISTORY") || 
      upperText.includes("CHECK HISTORY") || 
      upperText.includes("PAST RECORDS") ||
      upperText.includes("VEHICLE RECORD")
    ) {
      const regMatch = trimmed.match(/[A-Za-z]{2}\d{1,2}[A-Za-z]{1,2}\d{4}/) || trimmed.match(/DL6CR1517/i) || trimmed.match(/HR26DS6144/i) || trimmed.match(/HR26CW7677/i);
      const regNoVal = regMatch ? regMatch[0].toUpperCase() : "DL6CR1517"; // default to valid history reg
      
      const responseText = `Searching databases... Found past history files for vehicle **${regNoVal}**. Displaying comprehensive workshop logs now.`;
      
      setTimeout(() => {
        setTyping(false);
        addBotMessageSync(responseText, "vehicle-history", { regNo: regNoVal });
        
        // Hands-free Navigation Transition
        setActiveDashPanel("vehicle-history");
        setActiveDashPanelData({ regNo: regNoVal });
        setView("dashboard");

        if (speakResponses) {
          speakText(responseText.replace(/\*\*/g, ""));
        }
      }, 700);
      return;
    }

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: trimmed, chatType: activeChatType }),
      });
      const data = await response.json();
      setTyping(false);
      addBotMessageSync(data.botText, data.panel || undefined, data.initialData);
      
      // Hands-free navigation from custom AI responses
      if (data.panel) {
        setActiveDashPanel(data.panel);
        if (data.initialData) {
          setActiveDashPanelData(data.initialData);
        }
        
        // Let employee chat users read and converse without being hijacked to the dashboard automatically,
        // unless they explicitly ask to navigate, view, or open a panel.
        let isExplicitNav = 
          upperText.includes("GO TO") || 
          upperText.includes("SHOW") || 
          upperText.includes("OPEN PANEL") || 
          upperText.includes("LAUNCH") || 
          upperText.includes("NAVIGATE") || 
          upperText.includes("VIEW") || 
          upperText.includes("DISPLAY") ||
          upperText.includes("LOAD") ||
          upperText.includes("SWITCH TO") ||
          upperText.includes("MY APPOINT") ||
          upperText.includes("MY APPIOM") ||
          upperText.includes("YES") ||
          upperText.includes("OPEN IT") ||
          upperText.includes("CONFIRM");

        if (data.panel === "appointments" && (upperText.includes("APPOINTMENT") || upperText.includes("SCHEDULE") || upperText.includes("APPIOMNET"))) {
          isExplicitNav = true;
        }
        if (data.panel === "tasks" && (upperText.includes("TASK") || upperText.includes("TO DO") || upperText.includes("TODO"))) {
          isExplicitNav = true;
        }
        if (data.panel === "my-calls" && (upperText.includes("CALL") || upperText.includes("PHONE") || upperText.includes("CALLBACK"))) {
          isExplicitNav = true;
        }
        if (data.panel === "service-news" && (upperText.includes("NEWS") || upperText.includes("BULLETIN") || upperText.includes("CAMPAIGN"))) {
          isExplicitNav = true;
        }
        if (data.panel === "jc-opening" && (upperText.includes("JOB CARD") || upperText.includes("JC") || upperText.includes("CREATE") || upperText.includes("OPEN"))) {
          isExplicitNav = true;
        }
        if (data.panel === "vehicle-history" && (upperText.includes("HISTORY") || upperText.includes("PAST RECORDS") || upperText.includes("VEHICLE"))) {
          isExplicitNav = true;
        }
        if (data.panel === "all-jobcards" && (upperText.includes("ALL JOB") || upperText.includes("ACTIVE JC"))) {
          isExplicitNav = true;
        }

        if (activeChatType !== "employee" || isExplicitNav) {
          setActiveDashPanel(data.panel);
          if (data.initialData) {
            setActiveDashPanelData(data.initialData);
          }
          if (data.panel !== "welcome") {
            setView("dashboard");
          }
        }
      }

      if (speakResponses && data.botText) {
        speakText(data.botText.replace(/\*\*/g, ""));
      }
    } catch (error) {
      setTyping(false);
      let fallbackText = "I have processed your request. Opening relevant screen in your dashboard now.";
      let matchedPanel: PanelType | undefined = undefined;
      let matchedData: Record<string, unknown> | undefined = undefined;
      
      if (upperText.includes("HELLO") || upperText.includes("HI") || upperText.includes("HEY") || upperText.includes("HELO") || upperText.includes("GREETING")) {
        fallbackText = "Hello! How may I help you? Here is what I can do:\n1. Check your **Appointments & schedule** today\n2. Guide you on **how to open/create a Job Card**\n3. Review your **Tasks** or handle **Callbacks**\n4. Access **Suzuki Connect telematics**\n\nTell me, how can I help you today?";
      } else if (upperText.includes("APPOINTMENT") || upperText.includes("APPIOMNET") || upperText.includes("SCHEDULE")) {
        fallbackText = "Now pulling today's scheduled service appointments database.";
        matchedPanel = "appointments";
      } else if (upperText.includes("TASK") || upperText.includes("TO DO") || upperText.includes("TODO")) {
        fallbackText = "Opening your pending daily tasks audit dashboard.";
        matchedPanel = "tasks";
      } else if (upperText.includes("CALL") || upperText.includes("RESPONSE") || upperText.includes("PHONE") || upperText.includes("CALLBACK")) {
        fallbackText = "Loading scheduled callback queues and customer query response logs.";
        matchedPanel = "my-calls";
      } else if (upperText.includes("NEWS") || upperText.includes("BULLETIN") || upperText.includes("CAMPAIGN")) {
        fallbackText = "Displaying the latest NEXA service news, bulletins, and mandatory campaign updates.";
        matchedPanel = "service-news";
      }

      addBotMessageSync(fallbackText, matchedPanel, matchedData);
      
      if (matchedPanel) {
        setActiveDashPanel(matchedPanel);
        let isExplicitNav = 
          upperText.includes("GO TO") || 
          upperText.includes("SHOW") || 
          upperText.includes("OPEN PANEL") || 
          upperText.includes("LAUNCH") || 
          upperText.includes("NAVIGATE") || 
          upperText.includes("VIEW") || 
          upperText.includes("DISPLAY") ||
          upperText.includes("LOAD") ||
          upperText.includes("SWITCH TO") ||
          upperText.includes("MY APPOINT") ||
          upperText.includes("MY APPIOM") ||
          upperText.includes("YES") ||
          upperText.includes("OPEN IT") ||
          upperText.includes("CONFIRM");

        if (matchedPanel === "appointments" && (upperText.includes("APPOINTMENT") || upperText.includes("SCHEDULE") || upperText.includes("APPIOMNET"))) {
          isExplicitNav = true;
        }
        if (matchedPanel === "tasks" && (upperText.includes("TASK") || upperText.includes("TO DO") || upperText.includes("TODO"))) {
          isExplicitNav = true;
        }
        if (matchedPanel === "my-calls" && (upperText.includes("CALL") || upperText.includes("PHONE") || upperText.includes("CALLBACK"))) {
          isExplicitNav = true;
        }
        if (matchedPanel === "service-news" && (upperText.includes("NEWS") || upperText.includes("BULLETIN") || upperText.includes("CAMPAIGN"))) {
          isExplicitNav = true;
        }
        if (matchedPanel === "jc-opening" && (upperText.includes("JOB CARD") || upperText.includes("JC") || upperText.includes("CREATE") || upperText.includes("OPEN"))) {
          isExplicitNav = true;
        }
        if (matchedPanel === "vehicle-history" && (upperText.includes("HISTORY") || upperText.includes("PAST RECORDS") || upperText.includes("VEHICLE"))) {
          isExplicitNav = true;
        }
        if (matchedPanel === "all-jobcards" && (upperText.includes("ALL JOB") || upperText.includes("ACTIVE JC"))) {
          isExplicitNav = true;
        }

        if (activeChatType !== "employee" || isExplicitNav) {
          setView("dashboard");
        }
        if (matchedData) {
          setActiveDashPanelData(matchedData);
        }
      }

      if (speakResponses) {
        speakText(fallbackText);
      }
    }
  }

  async function handleSend() {
    const trimmed = input.trim()
    if (!trimmed && !attachedFile) return
    setInput("")

    let displayMessage = trimmed
    if (attachedFile) {
      displayMessage = `[📎 Attached ${attachedFile.type.toUpperCase()}: ${attachedFile.name}] ${trimmed}`
    }

    addUserMessage(displayMessage)
    setTyping(true)

    const currentAttachment = attachedFile;
    setAttachedFile(null);

    if (currentAttachment) {
      setTimeout(() => {
        setTyping(false);
        if (currentAttachment.type === 'image') {
          addBotMessageSync(
            `📎 Received image file: **${currentAttachment.name}**\n\n` +
            `🤖 **NEXA AI Body Damage Detection analysis complete:**\n` +
            `- **Rear Left Fender**: Moderate scratch section depth (32cm, repairable surface)\n` +
            `- **Rear Bumper Outer Shell**: Slight alignment drift on clip-mount locks\n` +
            `- **Suggested Job Card Demands**: *Rear left panel painting & bumper alignment audit* (Diagnostic estimate: **₹4,200**)\n\n` +
            `*Automatically opening Job Card Panel to view or complete checklist demands.*`,
            "jc-opening",
            { regNo: "" }
          );
          setActiveDashPanel("jc-opening");
          setActiveDashPanelData({ regNo: "" });
          setView("dashboard");
        } else if (currentAttachment.type === 'pdf') {
          addBotMessageSync(
            `📎 Received documents folder/PDF: **${currentAttachment.name}**\n\n` +
            `🤖 **NEXA AI Historical Service Summary:**\n` +
            `- **Vehicle Record ID**: DL6CR1517 (Matched past dealership databases)\n` +
            `- **Repairs summary**: 8 historic services successfully recorded. Fuel injectors serviced, battery updated with 36-month standard warranty coverage, sparks replaced (~45K km).\n` +
            `- **Advisories**: Brake pads wear was flagged at 3.5mm thickness limit. Recommending inspect pads.\n\n` +
            `*Automatically launching Vehicle History Search workspace panel.*`,
            "vehicle-history",
            { regNo: "DL6CR1517" }
          );
          setActiveDashPanel("vehicle-history");
          setActiveDashPanelData({ regNo: "DL6CR1517" });
          setView("dashboard");
        } else {
          addBotMessageSync(
            `📎 Upload folder processed successfully: **${currentAttachment.name}**.\n` +
            `Please specify what you would like me to extract or review from this custom workspace document.`
          );
        }
      }, 1200);
      return;
    }

    await processChatMessage(trimmed);
  }

  const BOT_TEXTS: Record<PanelType, string> = {
    welcome: `Hello! I am your NEXA Advisor Personal Assistant, here to help you manage your workshop day smoothly. 🚗✨\n\nHere is a quick look at your first few appointments for today:\n- **08:15 - 08:30**: HR26DS6144 (BALENO PETROL, Paid Service) - *Not Arrived*\n- **09:00 - 09:15**: HR26FK2786 (GRAND VITARA Smart Hybrid, Paid Service) - *Not Arrived*\n- **09:15 - 09:30**: HR26CW7677 (BALENO PETROL, Paid Service) - *Not Arrived*\n\nHow can I help you right now?\nYou can ask me to:\n1. Show your **full appointment list**.\n2. Guide you on **how to open a Job Card**.\n3. Check **Active Job Cards (WIP)**.\n4. Run a **Remote Diagnostic / DTC scan**.`,
    appointments: "Here are your appointments for today, 21-May-2026. You have 7 scheduled visits.",
    "vehicle-history": "Enter a registration number or VIN to pull the complete vehicle service history.",
    "jc-opening": "Starting Job Card Opening. Please scan or enter the vehicle registration number.",
    "all-jobcards": "Here are all your active and recent Job Cards.",
    tasks: "Here are your tasks for today, 21-May-2026. You have 6 pending items.",
    notifications: "You have 3 unread notifications — including 1 urgent alert.",
    "service-news": "Latest service news, campaigns, and mandatory updates from NEXA.",
    "my-calls": "You have 2 missed customer callback requests pending handling.",
    "suzuki-connect-form": "Starting Suzuki Connect Telematics request setup form.",
    "suzuki-connect-advice": "Loading telematics diagnostic feedback guidelines.",
    "close-jobcard": "Closing the specified job card. Please review all items.",
  }

  const ACTION_LABELS: Record<PanelType, string> = {
    welcome: "Home",
    appointments: "Show my appointments",
    "vehicle-history": "Check vehicle history",
    "jc-opening": "Open a new Job Card",
    "all-jobcards": "Show all Job Cards",
    tasks: "Show today's tasks",
    notifications: "Show notifications",
    "service-news": "Show service news",
    "my-calls": "Check Missed Calls Queue",
    "suzuki-connect-form": "Suzuki Connect installation request",
    "suzuki-connect-advice": "Suzuki Connect telematics advice",
    "close-jobcard": "Close job card",
  }

  function handleQuickAction(id: PanelType, data?: Record<string, unknown>) {
    if (activeChatType === "work" && view !== "chat") setView("chat")
    
    // Clear active temporary standalone panel states
    setActiveWorkPanel(null)
    setActiveWorkPanelData(undefined)
    setActiveDashPanel(null)
    setActiveDashPanelData(undefined)

    // Reset messages and session states to start a fresh, separately recorded chat session
    setMessages([])
    updateActiveSessionId(null)
    setJcSession(null)

    if (id === "jc-opening") {
      startChatJCOpening();
      return;
    }

    addUserMessage(ACTION_LABELS[id] || "Request: " + id)
    addBotMessageSync(BOT_TEXTS[id] || "Opening " + id, id, data)
    
    if (activeChatType === "work") {
      if (id !== "jc-opening") {
        setActiveWorkPanel(id)
        setActiveWorkPanelData(data)
      }
    } else if (activeChatType === "employee") {
      setActiveDashPanel(id)
      setActiveDashPanelData(data)
    }
  }

  function handleTileClick(panel: PanelType) {
    setView("chat")
    setTimeout(() => handleQuickAction(panel), 180)
  }

  function handleNewChat() {
    setMessages([])
    updateActiveSessionId(null)
    setJcSession(null)
    setActiveDashPanel(null)
    setActiveDashPanelData(undefined)
    setActiveWorkPanel(null)
    setActiveWorkPanelData(undefined)
    setView("chat")
  }

  function handleChangeChatType(type: "work" | "employee") {
    setActiveChatType(type)
    setMessages([])
    updateActiveSessionId(null)
    setJcSession(null)
    setActiveDashPanel(null)
    setActiveDashPanelData(undefined)
    setActiveWorkPanel(null)
    setActiveWorkPanelData(undefined)
    setView("chat")
  }

  const combinedHistory = [
    ...dbSessions.map(s => ({
      id: s.id,
      label: s.label,
      chatType: s.chatType || "work",
      section: (() => {
        const hrs = (Date.now() - new Date(s.updatedAt).getTime()) / 3600000;
        if (hrs < 24) return "Today";
        if (hrs < 48) return "Yesterday";
        return "7 Days";
      })(),
      isDb: true
    })),
    ...CHAT_HISTORY.map(h => ({ ...h, isDb: false, chatType: h.chatType || "work" }))
  ];

  const showWelcome = messages.length === 0 && view === "chat" && activeChatType !== "work"

  if (!authenticated) {
    return <LoginScreen onLoginSuccess={() => setAuthenticated(true)} theme={theme} setTheme={setTheme} />
  }

  return (
    <div 
      className={`h-screen flex text-foreground overflow-hidden transition-colors duration-300 relative z-10 w-full ${theme === "dark" ? "dark bg-[#050505]" : "bg-background"}`} 
      style={{ 
        fontFamily: "'Roboto', sans-serif",
        backgroundImage: theme === "dark" ? 'radial-gradient(ellipse at 50% -20%, rgba(30, 40, 60, 0.3), transparent 70%)' : 'none'
      }}
    >
      {/* Dynamic diagonal stripe pattern background similar to the image (subtle) */}
      {theme === "dark" && (
        <div 
          className="absolute inset-0 z-0 opacity-10 pointer-events-none" 
          style={{ backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 4px, rgba(255,255,255,0.05) 4px, rgba(255,255,255,0.05) 8px)' }}
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <AnimatePresence initial={false}>
        {sidebarOpen && view === "chat" && (
          <motion.div key="sidebar"
            initial={{ width: 0, opacity: 0 }} animate={{ width: 256, opacity: 1 }} exit={{ width: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="shrink-0 overflow-hidden h-full">
            <Sidebar 
              onNav={(id) => {
                handleQuickAction(id);
              }} 
              onNewChat={() => setShowNewChatModal(true)} 
              setSidebarOpen={setSidebarOpen} 
              history={combinedHistory}
              activeSessionId={activeSessionId}
              onSelectSession={handleSelectSession}
              onRenameSession={handleRenameSession}
              onDeleteSession={handleDeleteSession}
              activeChatType={activeChatType}
              onChangeChatType={handleChangeChatType}
              jcSession={jcSession}
              onGoDashboard={() => setView("dashboard")}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main panel ──────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0">

        {/* Top bar */}
        {view !== "dashboard" && (
          <div className="shrink-0 h-[60px] flex items-center justify-between px-6 border-b border-border/20 bg-transparent backdrop-blur-md z-20 relative">
            <div className="flex items-center gap-3">
              {view === "chat" && !sidebarOpen && (
                <button onClick={() => setSidebarOpen(true)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-card transition-colors">
                  <ChevronRight size={14} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-4 text-muted-foreground mr-2">
              <div className="hidden sm:flex items-center gap-1.5 px-3 mr-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#4ADE80] animate-pulse" />
                <span className="text-[10.5px] text-muted-foreground font-mono">21 May 2026 · 10:32 AM</span>
              </div>

              {/* Dashboard Toggle Button */}
              <button
                onClick={() => setView("dashboard")}
                className="hover:text-foreground transition-colors cursor-pointer flex items-center justify-center"
                title="Go to Dashboard"
              >
                <LayoutDashboard size={18} strokeWidth={1.5} />
              </button>

              {/* Theme Toggle Button */}
              <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="hover:text-foreground transition-colors cursor-pointer flex items-center justify-center"
                title={`Switch to ${theme === "dark" ? "Light" : "Dark"} Mode`}
              >
                {theme === "dark" ? <Sun size={18} strokeWidth={1.5} className="text-[#FACC15]" /> : <Moon size={18} strokeWidth={1.5} className="text-secondary-foreground" />}
              </button>

              {/* Logout Button */}
              <button
                onClick={() => { localStorage.removeItem("nexa-authenticated"); window.location.reload(); }}
                className="hover:text-[#F87171] transition-colors cursor-pointer flex items-center justify-center"
                title="Log Out"
              >
                <LogOut size={18} strokeWidth={1.5} />
              </button>
            </div>
          </div>
        )}

        {/* Content area */}
        <AnimatePresence mode="wait">
          {view === "dashboard" ? (
            <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }} className="flex-1 flex flex-col min-h-0 overflow-y-auto scrollbar-none bg-transparent">
              {activeDashPanel ? (
                <div className="flex-1 flex flex-col min-h-0 bg-transparent p-6">
                  {/* Standalone Dashboard Flow Header */}
                  <div className="flex items-center justify-between mb-5 pb-3.5 border-b border-border shrink-0">
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => { setActiveDashPanel(null); }}
                        className="text-primary hover:text-white text-[12px] font-black font-sans flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 hover:bg-primary border border-primary/20 transition-all cursor-pointer shadow-sm hover:shadow-primary/30 uppercase tracking-wider"
                      >
                        <ChevronLeft size={14} /> Back to Dashboard
                      </button>
                      <span className="text-muted-foreground/30 font-sans">/</span>
                      <span className="text-foreground text-[14px] font-bold uppercase tracking-wider font-sans flex items-center gap-1.5">
                        {activeDashPanel.replace("-", " ")} Workspace
                      </span>
                    </div>
                  </div>
                  
                  {/* Standalone Panel Workspace */}
                  <div className="flex-1 overflow-y-auto scrollbar-none min-h-0">
                    <PanelRenderer 
                      panel={activeDashPanel} 
                      initialData={activeDashPanelData}
                      onAction={(actionId, data) => {
                        if (actionId === "welcome") {
                          setActiveDashPanel(null);
                          setActiveDashPanelData(undefined);
                        } else {
                          setActiveDashPanel(actionId);
                          setActiveDashPanelData(data);
                        }
                      }} 
                    />
                  </div>
                </div>
              ) : (
                <DashboardView onTileClick={(panel) => handleTileClick(panel)} onReturnToChat={() => setView("chat")} theme={theme} setTheme={setTheme} />
              )}
            </motion.div>
          ) : (
            <motion.div key="chat" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }} className="flex-1 flex flex-col min-h-0 bg-transparent overflow-hidden animate-fade-in">
              {activeChatType === "work" && activeSessionId === null ? (
                /* ── Direct Interactive Work Mode (No Chatting Allowed) ─────────────────── */
                activeWorkPanel ? (
                  <div className="flex-1 flex flex-col min-h-0 bg-transparent p-6">
                    {/* Header with back button */}
                    <div className="flex items-center justify-between mb-5 pb-3.5 border-b border-border shrink-0">
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => { 
                            setActiveWorkPanel(null); 
                            setActiveWorkPanelData(undefined);
                          }}
                          className="text-primary hover:text-white text-[12px] font-black font-sans flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 hover:bg-primary border border-primary/20 transition-all cursor-pointer shadow-sm hover:shadow-primary/30 uppercase tracking-wider"
                        >
                          <ChevronLeft size={14} /> Back to Work Station
                        </button>
                        <span className="text-muted-foreground/30 font-sans">/</span>
                        <span className="text-foreground text-[14px] font-bold uppercase tracking-wider font-sans flex items-center gap-1.5">
                          {activeWorkPanel === "jc-opening" ? "New Job Card Registration" : activeWorkPanel.replace("-", " ")}
                        </span>
                      </div>
                      <div className="text-[10.5px] font-bold font-sans text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full uppercase tracking-wider select-none animate-pulse">
                        Active Workshop Tool
                      </div>
                    </div>
                    {/* Active Work Panel content */}
                    <div className="flex-1 overflow-y-auto scrollbar-none min-h-0">
                      <PanelRenderer 
                        panel={activeWorkPanel} 
                        initialData={activeWorkPanelData}
                        onAction={(actionId, data) => {
                          if (actionId === "welcome") {
                            setActiveWorkPanel(null);
                            setActiveWorkPanelData(undefined);
                          } else {
                            setActiveWorkPanel(actionId);
                            setActiveWorkPanelData(data);
                          }
                        }} 
                      />
                    </div>
                  </div>
                ) : (
                  /* ── Work Station Launcher Menu ───────────────────────────────────────── */
                  <div className="flex-1 flex flex-col justify-center items-center p-8 max-w-4xl mx-auto w-full transition-all overflow-y-auto scrollbar-none">
                    <div className="relative text-center mb-10 max-w-xl">
                      {/* Decorative Workspace Icon */}
                      <div className="relative w-[68px] h-[68px] mx-auto mb-5 flex items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 shadow-lg shadow-primary/5">
                        <Wrench size={32} className="text-primary animate-pulse" />
                      </div>
                      <h2 className="text-[24px] font-black text-foreground font-sans tracking-tight uppercase">
                        NEXA Workshop Station
                      </h2>
                      <p className="text-[13px] text-muted-foreground mt-2 leading-relaxed font-sans">
                        Direct access control interface. Select an operation card to manage workshop entries, register job statuses, or search physical records instantly.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full px-4 mb-4">
                      {/* Card 1: Open New Job Card */}
                      <button
                        onClick={() => handleQuickAction("jc-opening")}
                        className="group flex flex-col items-start p-6 rounded-2xl border border-border bg-card hover:bg-secondary/20 hover:border-primary/50 hover:shadow-xl transition-all text-left relative overflow-hidden cursor-pointer h-full"
                      >
                        <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-xl group-hover:bg-primary/10 transition-all pointer-events-none" />
                        <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shrink-0">
                          <Plus size={18} className="text-primary" />
                        </div>
                        <h3 className="font-bold text-[14px] text-foreground font-sans uppercase tracking-wider">
                          Open Job Card
                        </h3>
                        <p className="text-[12px] text-muted-foreground mt-2 leading-relaxed font-sans flex-1">
                          Register vehicle check-ins, record VIN parameters, inspect body conditions, and list customer repair service requirements.
                        </p>
                        <div className="mt-5 w-full flex items-center justify-between text-primary text-[11px] font-bold uppercase tracking-widest font-sans pt-3 border-t border-border/40">
                          <span>Start Form</span>
                          <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                        </div>
                      </button>

                      {/* Card 2: Job Card Workspace */}
                      <button
                        onClick={() => handleQuickAction("all-jobcards")}
                        className="group flex flex-col items-start p-6 rounded-2xl border border-border bg-card hover:bg-secondary/20 hover:border-primary/50 hover:shadow-xl transition-all text-left relative overflow-hidden cursor-pointer h-full"
                      >
                        <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-xl group-hover:bg-primary/10 transition-all pointer-events-none" />
                        <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shrink-0">
                          <ClipboardList size={18} className="text-primary" />
                        </div>
                        <h3 className="font-bold text-[14px] text-foreground font-sans uppercase tracking-wider">
                          Service Job Cards
                        </h3>
                        <p className="text-[12px] text-muted-foreground mt-2 leading-relaxed font-sans flex-1">
                          Manage active workshop tickets, check diagnostics dispatch estimates, review statuses, and process closures.
                        </p>
                        <div className="mt-5 w-full flex items-center justify-between text-primary text-[11px] font-bold uppercase tracking-widest font-sans pt-3 border-t border-border/40">
                          <span>View Cards</span>
                          <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                        </div>
                      </button>

                      {/* Card 3: Vehicle History */}
                      <button
                        onClick={() => handleQuickAction("vehicle-history")}
                        className="group flex flex-col items-start p-6 rounded-2xl border border-border bg-card hover:bg-secondary/20 hover:border-primary/50 hover:shadow-xl transition-all text-left relative overflow-hidden cursor-pointer h-full"
                      >
                        <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-xl group-hover:bg-primary/10 transition-all pointer-events-none" />
                        <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shrink-0">
                          <Car size={18} className="text-primary" />
                        </div>
                        <h3 className="font-bold text-[14px] text-foreground font-sans uppercase tracking-wider">
                          Vehicle History
                        </h3>
                        <p className="text-[12px] text-muted-foreground mt-2 leading-relaxed font-sans flex-1">
                          Access historical diagnostics logs, past workshop service items, previous invoices, and registered client records.
                        </p>
                        <div className="mt-5 w-full flex items-center justify-between text-primary text-[11px] font-bold uppercase tracking-widest font-sans pt-3 border-t border-border/40">
                          <span>Search History</span>
                          <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                        </div>
                      </button>
                    </div>
                  </div>
                )
              ) : (
                /* ── Standard Chat Flow Workspace ──────────────────────────────────── */
                <>
                  {activeChatType === "work" && activeSessionId !== null && (
                    <div className="flex items-center justify-between mx-6 mt-6 pb-3.5 border-b border-border shrink-0">
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => { 
                             setMessages([]);
                             updateActiveSessionId(null);
                             setJcSession(null);
                          }}
                          className="text-primary hover:text-white text-[12px] font-black font-sans flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 hover:bg-primary border border-primary/20 transition-all cursor-pointer shadow-sm hover:shadow-primary/30 uppercase tracking-wider"
                        >
                          <ChevronLeft size={14} /> Back to Work Station Dashboard
                        </button>
                      </div>
                      <div className="text-[10.5px] font-bold font-sans text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full uppercase tracking-wider select-none animate-pulse shadow-sm">
                        Active Job Card Workflow
                      </div>
                    </div>
                  )}

                  {/* Welcome or chat messages */}
                  <AnimatePresence mode="wait">
                    {loadingChat ? (
                      <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="flex-1 flex flex-col justify-center items-center p-6 text-center">
                        <div className="w-10 h-10 rounded-full border-4 border-primary border-t-transparent animate-spin mb-4" />
                        <p className="text-[14px] font-bold text-foreground font-sans uppercase tracking-widest leading-relaxed">Syncing Dialogue Files</p>
                        <p className="text-[11.5px] text-muted-foreground font-mono mt-1">Retrieving conversation logs from NEXA Cloud Database Engine...</p>
                      </motion.div>
                    ) : showWelcome ? (
                      <motion.div key="welcome" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.25 }} className="flex-1 flex flex-col min-h-0">
                        <WelcomeScreen onNavToPanel={(id) => {
                          handleQuickAction(id);
                        }} chatType={activeChatType} theme={theme} />
                      </motion.div>
                    ) : (
                      <motion.div key="messages" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        ref={chatRef} className="flex-1 overflow-y-auto py-8 flex flex-col gap-7 scrollbar-none">
                        <div className="max-w-3xl mx-auto w-full px-6 flex flex-col gap-7">
                          {messages.map(msg => (
                            msg.role === "user"
                              ? <UserBubble key={msg.id} text={msg.text} timestamp={msg.timestamp} />
                              : <BotBubble 
                                  key={msg.id} 
                                  text={msg.text} 
                                  panel={msg.panel} 
                                  onAction={handleQuickAction} 
                                  timestamp={msg.timestamp} 
                                  initialData={msg.initialData}
                                  isJcStep={msg.isJcStep}
                                  jcStepCode={msg.jcStepCode}
                                  jcSession={jcSession}
                                  setJcSession={setJcSession}
                                  advanceJcChat={advanceJcChat}
                                />
                          ))}
                          <AnimatePresence>
                            {typing && (
                              <motion.div
                                key="typing-indicator"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                              >
                                <TypingIndicator />
                              </motion.div>
                            )}
                          </AnimatePresence>

                          <div className="h-2" />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Input bar — conditional visibility */}
                  {activeChatType !== "work" && (
                    <div className="shrink-0 px-6 pb-5 pt-3 border-t border-border/20 bg-transparent backdrop-blur-md">
                      <div className="max-w-3xl mx-auto flex flex-col">

                      {isScanningInChat && (
                        <div className="mb-3.5 bg-background rounded-2xl border border-dashed border-primary/30 p-1 overflow-hidden shadow-2xl">
                          <PlateScanner 
                            onScan={(res) => {
                              setInput(`Check vehicle history for ${res}`);
                              setIsScanningInChat(false);
                            }} 
                            onClose={() => setIsScanningInChat(false)} 
                          />
                        </div>
                      )}
                      {isVoiceHUDOpen && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }} 
                          animate={{ opacity: 1, y: 0 }} 
                          className="mb-3.5 p-4 rounded-2xl border border-border bg-card shadow-2xl relative overflow-hidden"
                        >
                          {/* Tech grid style */}
                          <div className="absolute inset-0 bg-[linear-gradient(rgba(239,68,68,0.03)_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />
                          
                          <div className="relative z-10 flex flex-col gap-3">
                            <div className="flex items-center justify-between border-b border-red-500/10 pb-2">
                              <div className="flex items-center gap-2">
                                <span className={`flex items-center justify-center w-2 h-2 rounded-full ${isListening ? 'bg-red-500 animate-ping' : 'bg-amber-400'}`} />
                                <span className={`text-[11.5px] uppercase tracking-wider font-extrabold font-sans flex items-center gap-1 ${isListening ? 'text-red-500' : 'text-amber-400'}`}>
                                  <Mic size={12} className={isListening ? "text-red-500 animate-bounce" : "text-amber-400"} /> 
                                  {isListening ? "NEXA Voice Assistant - Live Listening" : "NEXA Voice Assistant - Standby"}
                                </span>
                              </div>
                              
                              {/* Live Rhythmic Sound Wave */}
                              <div className="flex gap-1.5 items-center bg-card/70 px-2.5 py-1 rounded-full border border-red-500/10">
                                {[0.1, 0.4, 0.2, 0.6, 0.3, 0.5, 0.2].map((delay, index) => (
                                  <div 
                                    key={index} 
                                    className={`w-0.5 rounded-full transition-all duration-300 ${isListening ? (index === 3 ? 'bg-[#4ADE80]' : 'bg-red-500') : 'bg-muted-foreground/30'}`}
                                    style={{
                                      height: index % 2 === 0 ? '12px' : '18px',
                                      animation: isListening ? `bounce 0.5s infinite alternate` : undefined,
                                      animationDelay: isListening ? `${delay}s` : undefined
                                    }}
                                  />
                                ))}
                              </div>
                            </div>

                            {/* Transcript Preview */}
                            <div className="bg-card/40 rounded-xl px-3 py-2.5 border border-red-500/5 min-h-[44px] flex flex-col justify-center">
                              <span className="text-[9px] uppercase font-bold text-muted-foreground/50 tracking-wider">Sound Input Live Transcript:</span>
                              <span className="text-[12.5px] font-medium text-foreground tracking-wide mt-0.5 font-sans italic">
                                "{interimText || (isListening ? 'Speak now... (e.g. "Open Job Card dl6cr1517")' : 'Voice capture inactive. Press microphone button above to start, or simulate below.')}"
                              </span>
                            </div>

                            {/* Fallback & Helper HUD options */}
                            <div className="flex flex-col gap-2 mt-1 border-t border-red-500/5 pt-3">
                              <div className="flex items-center gap-1.5 justify-between">
                                <span className="text-[10px] text-red-400 font-sans font-bold uppercase tracking-wider flex items-center gap-1">
                                  ℹ️ Voice HUD Control Center
                                </span>
                                <button 
                                  onClick={() => {
                                    setIsListening(false);
                                    setIsVoiceHUDOpen(false);
                                    setInterimText("");
                                  }}
                                  className="text-[9.5px] text-muted-foreground hover:text-white underline cursor-pointer"
                                >
                                  Dismiss HUD
                                </button>
                              </div>
                              
                              {speechError && (
                                <p className="text-[11px] text-amber-400 font-semibold bg-card px-2.5 py-1.5 rounded-lg border border-amber-500/20 leading-relaxed font-sans">
                                  🛡️ {speechError}
                                </p>
                              )}

                              <p className="text-[9.5px] text-muted-foreground uppercase font-bold font-sans tracking-widest mt-1">
                                Click to simulate vocal command instantly (Hands-Free Demonstration):
                              </p>
                              
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {[
                                  { label: "🎙️ Open Job Card for DL6CR1517", val: "Open Job Card for DL6CR1517" },
                                  { label: "🔬 Check vehicle history for HR26DS6144", val: "Check vehicle history for HR26DS6144" },
                                  { label: "📅 Show today's scheduled appointments", val: "Show today's scheduled appointments font-bold" },
                                  { label: "✅ Review pending tasks", val: "Review pending tasks" }
                                ].map((cmd, i) => (
                                  <button
                                    key={i}
                                    onClick={() => {
                                      setInput(cmd.val);
                                      handleSendVoice(cmd.val);
                                      setIsListening(false);
                                      setIsVoiceHUDOpen(false);
                                      setInterimText("");
                                    }}
                                    className="px-3 py-2 bg-card border border-red-500/10 text-left text-[11.5px] rounded-lg text-red-300 hover:border-red-500/40 hover:text-white hover:bg-red-500/5 transition-all text-ellipsis overflow-hidden whitespace-nowrap cursor-pointer flex items-center gap-2 font-semibold"
                                  >
                                    {cmd.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                      {attachedFile && (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-xl mb-3 inline-flex max-w-[280px]">
                          <span className="text-[11px] font-bold text-primary font-sans uppercase shrink-0">{attachedFile.type}:</span>
                          <span className="text-[11.5px] text-foreground truncate font-sans">{attachedFile.name}</span>
                          <button onClick={() => setAttachedFile(null)} className="text-muted-foreground hover:text-white p-0.5 rounded cursor-pointer shrink-0"><X size={12} /></button>
                        </div>
                      )}
                      <div className="flex items-center gap-2 bg-card rounded-2xl border border-border focus-within:border-primary/35 transition-all px-4 py-3 shadow-lg shadow-black/20 font-bold">
                        <input
                          value={input}
                          onChange={e => setInput(e.target.value)}
                          onKeyDown={e => e.key === "Enter" && handleSend()}
                          placeholder="Ask or speak to open a job card, fetch vehicle history, check appointments..."
                          className="flex-1 bg-transparent outline-none text-foreground text-[13px] placeholder:text-muted-foreground font-sans font-semibold"
                        />
                        <div className="flex items-center gap-1.5">
                          <button 
                            onClick={toggleListening}
                            className={`p-1.5 rounded-lg transition-all flex items-center justify-center cursor-pointer ${
                              isListening 
                                ? "text-red-400 bg-red-500/10 animate-pulse border border-red-500/20" 
                                : isVoiceHUDOpen 
                                ? "text-amber-400 bg-amber-500/10 border border-amber-500/20" 
                                : "text-muted-foreground hover:text-primary hover:bg-card"
                            }`}
                            title={isListening ? "Listening... click to stop" : isVoiceHUDOpen ? "Voice Hub Active (Simulation mode)" : "Speak to Voice Assistant"}
                          >
                            <Mic size={14} className={isListening ? "scale-110 text-red-400" : ""} />
                          </button>
                          <button 
                            onClick={() => setIsScanningInChat(!isScanningInChat)}
                            className={`p-1.5 rounded-lg transition-all flex items-center justify-center cursor-pointer ${isScanningInChat ? "text-primary bg-primary/10 animate-pulse border border-primary/20" : "text-muted-foreground hover:text-primary hover:bg-card"}`}
                            title="Scan license plate using camera / OCR"
                          >
                            <Camera size={14} className={isScanningInChat ? "text-primary scale-110" : "text-muted-foreground"} />
                          </button>
                          <button onClick={handleSend} disabled={!input.trim() && !attachedFile}
                            className="w-8 h-8 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/95 transition-all disabled:opacity-25 disabled:cursor-not-allowed shadow-md shadow-primary/20 cursor-pointer">
                            <Send size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                  )}
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* New Chat Type Picker Modal */}
      <AnimatePresence>
        {showNewChatModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setShowNewChatModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", duration: 0.35 }}
              className="relative w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col font-sans"
            >
              {/* Header */}
              <div className="flex justify-between items-center px-6 py-4 border-b border-border bg-card/50">
                <div>
                  <h3 className="text-base font-bold text-foreground">Start New Conversation</h3>
                  <p className="text-[11.5px] text-muted-foreground mt-0.5">Select a digital assistant flow tailored for your task</p>
                </div>
                <button 
                  onClick={() => setShowNewChatModal(false)} 
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-secondary/20 text-muted-foreground hover:text-foreground transition-all font-bold text-lg leading-none cursor-pointer"
                >
                  ×
                </button>
              </div>

              {/* Options Body */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6 bg-background/30">
                {/* Option 1: Workshop Station */}
                <button
                  onClick={() => {
                    handleChangeChatType("work");
                    setShowNewChatModal(false);
                  }}
                  className={`group flex flex-col items-start p-5 rounded-2xl border transition-all text-left bg-card/60 relative overflow-hidden cursor-pointer ${
                    activeChatType === "work" 
                      ? "border-primary/60 hover:border-primary ring-1 ring-primary/40 bg-primary/5" 
                      : "border-border hover:border-primary/40 hover:bg-card/90"
                  }`}
                >
                  {/* Visual Highlight Decor */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-all pointer-events-none" />
                  
                  <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center mb-3.5 group-hover:scale-105 transition-transform shrink-0">
                    <Wrench size={20} className="text-primary" />
                  </div>
                  <div className="font-bold text-[14px] text-foreground flex items-center gap-2">
                    Workshop Station
                    {activeChatType === "work" && (
                      <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-full bg-primary/20 text-primary uppercase tracking-wider font-sans">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] text-muted-foreground mt-1.5 leading-relaxed">
                    Direct access workshop control panel. Open job cards, check service items, scan licenses, and view vehicle history without AI chatting.
                  </p>
                  <div className="mt-4 pt-3.5 border-t border-border/60 w-full flex flex-wrap gap-1.5">
                    <span className="text-[10px] font-semibold px-2 py-0.5 bg-secondary/45 border border-border/40 text-muted-foreground/90 rounded-md font-sans">
                      License Scanning
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 bg-[#10B981]/15 border border-[#10B981]/25 text-[#10B981] rounded-md font-sans">
                      Job Cards
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 bg-secondary/45 border border-border/40 text-muted-foreground/90 rounded-md font-sans">
                      Vehicle History
                    </span>
                  </div>
                </button>

                {/* Option 2: Employee Chat */}
                <button
                  onClick={() => {
                    handleChangeChatType("employee");
                    setShowNewChatModal(false);
                  }}
                  className={`group flex flex-col items-start p-5 rounded-2xl border transition-all text-left bg-card/60 relative overflow-hidden cursor-pointer ${
                    activeChatType === "employee" 
                      ? "border-primary/60 hover:border-primary ring-1 ring-primary/40 bg-primary/5" 
                      : "border-border hover:border-primary/40 hover:bg-card/90"
                  }`}
                >
                  {/* Visual Highlight Decor */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-all pointer-events-none" />

                  <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center mb-3.5 group-hover:scale-105 transition-transform shrink-0">
                    <User size={20} className="text-primary" />
                  </div>
                  <div className="font-bold text-[14px] text-foreground flex items-center gap-2">
                    Employee Chat
                    {activeChatType === "employee" && (
                      <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-full bg-primary/20 text-primary uppercase tracking-wider font-sans">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] text-muted-foreground mt-1.5 leading-relaxed">
                    Focuses on personal schedule tracking, work assignments, customer calls, and announcements.
                  </p>
                  <div className="mt-4 pt-3.5 border-t border-border/60 w-full flex flex-wrap gap-1.5">
                    <span className="text-[10px] font-semibold px-2 py-0.5 bg-secondary/45 border border-border/40 text-muted-foreground/90 rounded-md font-sans">
                      Personal Calls
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 bg-[#A78BFA]/20 border border-[#A78BFA]/30 text-[#A78BFA] rounded-md font-sans">
                      Appointments
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 bg-secondary/45 border border-border/40 text-muted-foreground/90 rounded-md font-sans">
                      My Tasks
                    </span>
                  </div>
                </button>
              </div>

              {/* Footer */}
              <div className="px-6 py-3 border-t border-border bg-card/50 flex justify-end gap-2 shrink-0">
                <button 
                  onClick={() => setShowNewChatModal(false)}
                  className="px-4 py-1.5 text-[12px] font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary/20 rounded-xl transition-all cursor-pointer font-sans"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

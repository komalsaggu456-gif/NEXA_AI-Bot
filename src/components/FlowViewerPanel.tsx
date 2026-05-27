import { useState } from "react";
import { ChevronDown, ChevronRight, CheckCircle, Database } from "lucide-react";

const OPEN_STEPS = [
  {
    step: 0, label: "Scan vehicle registration plate", tag: "Step 1 of 8", color: "#854F0B", dotBg: "#FAEEDA",
    inputs: ["Scan Registration No (barcode / RFID)*", "Scan Chassis VIN (optional)"],
    outputs: ["jobCardData.registrationNo populated"],
    note: "Gate: next button disabled until registrationNo is set. Triggers ScannerModal with type REG_NO or VIN_NO.",
    guard: "!jobCardData.registrationNo → disabled"
  },
  {
    step: 1, label: "Enter customer & vehicle details", tag: "Step 2 of 6", color: "#185FA5", dotBg: "#E6F1FB",
    inputs: ["Registration No (Read-only)", "Odometer Reading (KMS)*", "Service Type* (Dropdown: PAID SERVICE, FREE SERVICE, RUNNING REPAIR)", "Gate In Date/Time*", "CNG Vehicle Toggle", "Customer Name (Read-only from DMS)", "Mobile No. 1*", "Mobile No. 2 (Optional)", "Email*"],
    outputs: ["jobCardData.customerName, customerMobile, customerEmail, odometerReading, serviceType, isCng, gateInDate"],
    note: "Many background fields auto-populated from DMS. Sub-Service Type auto-populated based on Service Type. Replaces previous separate Odometer and Service Type steps.",
    guard: "!odometerReading || !serviceType → disabled"
  },
  {
    step: 2, label: "Inspect vehicle damage & register car images", tag: "Step 3 of 6", color: "#854F0B", dotBg: "#FAEEDA",
    inputs: ["CarSchematic interactive damage nodes (SCRATCH / DENT / BROKEN / NOT_FOUND)", "Scan Barcode → adds image URL", "Upload File → adds image URL", "Capture Live → adds image URL from camera"],
    outputs: ["jobCardData.damages[] — array of {id, part, type, nodeId}", "jobCardData.carImages.exterior[] — array of image URLs"],
    note: "At least 1 photo required. Photos can be removed per-item. Uses CarSchematic component for visual damage marking.",
    guard: "No explicit guard — user can proceed without damage"
  },
  {
    step: 3, label: "Add customer demanded repairs", tag: "Step 4 of 6", color: "#185FA5", dotBg: "#E6F1FB",
    inputs: ["Repair Description (free text)", "Labor Code (e.g. ZA11L0)", "Estimate Price (₹, number)"],
    outputs: ["jobCardData.demandedRepairs[] — {id, description, code, price, customerVoice}"],
    note: "Each entry is added via an Add button. Items can be deleted. The list is scrollable and persists across steps.",
    guard: "None — can proceed with 0 repairs"
  },
  {
    step: 4, label: "Specify estimate labor checklists", tag: "Step 5 of 6", color: "#185FA5", dotBg: "#E6F1FB",
    inputs: ["Quick-select labor presets (checkbox toggle)", "Custom entries via Add flow (same pattern as repairs)"],
    outputs: ["jobCardData.laborDetails[] — {id, description, code, price, hours, billableType}"],
    note: "Presets: ZA11L0 Wheel Alignment ₹575, ZA04L0 Wheel Balancing ₹400, ZA15L0 Washing ₹665. Toggling a preset adds/removes from laborDetails.",
    guard: "None"
  },
  {
    step: 5, label: "Audit summary, sign & transmit", tag: "Step 6 of 6", color: "#993C1D", dotBg: "#FAECE7",
    inputs: ["Customer Signature (click-to-sign simulation)", "Print Summary action", "Email copy to customer action"],
    outputs: ["Calculated totals: totalLabor + totalParts = grandEst", "onFlowCompleted() callback triggered"],
    note: "Summary card shows: reg no, vehicle model, customer name, service type, labor subtotal, parts subtotal, grand total. Signature captures first name. TRANSMIT button fires the completion callback.",
    guard: "Signature not required to submit (no guard)"
  }
];

const CLOSE_STEPS = [
  {
    step: 0, label: "Select active job card to close", tag: "Step 1 of 6", color: "#185FA5", dotBg: "#E6F1FB",
    inputs: ["Dropdown: select from EXISTING_JOB_CARDS list (jobCardNo — regNum — customerName)"],
    outputs: ["jobCardData.registrationNo, customerName, customerMobile, vehicleModel populated from selected card"],
    note: "Data source: EXISTING_JOB_CARDS[] from data.ts. Status 'Job Card Opened' cards appear here.",
    guard: "!registrationNo → next disabled"
  },
  {
    step: 1, label: "Allocate workshop bay & technician", tag: "Step 2 of 6", color: "#185FA5", dotBg: "#E6F1FB",
    inputs: ["Active Work Bay (dropdown: BAY-04, BAY-01, BAY-02, BAY-03)", "Lead Group (dropdown: MAIN-GRP, EXPRESS-GRP, ALIGN-GRP)", "Technician Name (text input)"],
    outputs: ["jobCardData.bayCode, groupCode, technicianName"],
    note: "Maps to Slide 19 in original spec. Bay allocation is a workshop operations step, not customer-facing.",
    guard: "None"
  },
  {
    step: 2, label: "Verify final odometer & payment mode", tag: "Step 3 of 6", color: "#185FA5", dotBg: "#E6F1FB",
    inputs: ["Odometer Mileage KMS (number, verify/update)", "Payment Mode (dropdown: UPI / Cash / Card)"],
    outputs: ["jobCardData.odometerReading, paymentMode"],
    note: "Closing odometer reading may differ from opening. Payment mode set here before invoice generation.",
    guard: "None"
  },
  {
    step: 3, label: "Review technical labor estimates", tag: "Step 4 of 6", color: "#0F6E56", dotBg: "#E1F5EE",
    inputs: [],
    outputs: ["Read-only list of laborDetails[] with code, description, price × hours", "Calculated: totalLabor sum"],
    note: "Scrollable read-only list. No editing at this stage. Shows sum total at bottom.",
    guard: "None"
  },
  {
    step: 4, label: "Verify TCS tax parameters", tag: "Step 5 of 6", color: "#185FA5", dotBg: "#E6F1FB",
    inputs: ["TCS on Customer (dropdown: NO / YES - Under section 206C(1H))", "TCS on Insurance Debits (dropdown: NO / YES)"],
    outputs: ["jobCardData.taxCustomer, taxInsurance"],
    note: "TCS 0.1% applicable on sale >₹50L under section 206C(1H). Third field taxEwr exists in type but not rendered in this step.",
    guard: "None — Calculate Invoice button always enabled"
  },
  {
    step: 5, label: "Pre-invoice summary & close job card", tag: "Step 6 of 6", color: "#993C1D", dotBg: "#FAECE7",
    inputs: ["Verify pre-invoice (read-only)", "CLOSE JOBCARD & DISPATCH INVOICE button"],
    outputs: ["Calculated: totalLabor + totalParts = grandEst (grand total)", "onFlowCompleted() callback with invoice message"],
    note: "Summary shows: reg no, supervisor+bay, aggregate labor, aggregate parts, grand total. Fires invoice generation message on close.",
    guard: "None"
  }
];

const HISTORY_STEPS = [
  {
    step: 0, label: "Registration plate lookup", tag: "Single view", color: "#854F0B", dotBg: "#FAEEDA",
    inputs: ["Registration plate (text input, pre-filled with current jobCardData.registrationNo or UK18P2194)", "📷 Scan New Plate button → triggers ScannerModal (REG_NO type)"],
    outputs: ["Filtered VEHICLE_HISTORIES[] displayed in table"],
    note: "Data source: VEHICLE_HISTORIES[] from data.ts. Each record: {serial, serviceDate, serviceType, mileage, dealerDescription}. Table columns: S.No, Service Date, Service Type, Mileage (KMS), Dealer Description. Done button fires onFlowCompleted callback.",
    guard: "None — always shows all records (filtering by reg no is UI-only in current impl)"
  }
];

const TYPES_DATA = [
  {
    name: "WorkshopFlowState",
    desc: "Top-level state passed as flowState prop to NexaWorkflows",
    fields: [
      { key: "activeFlow", type: '\"none\" | \"open_job_card\" | \"close_job_card\" | \"vehicle_history\"' },
      { key: "currentStep", type: "number" },
      { key: "jobCardData", type: "JobCardDetails" }
    ]
  },
  {
    name: "JobCardDetails",
    desc: "Shared mutable data object updated across all steps via handleInputChange()",
    fields: [
      { key: "registrationNo, customerName, customerMobile, customerEmail", type: "string" },
      { key: "vehicleModel, vehicleVariant, customerVoice, odometerReading", type: "string" },
      { key: "serviceType, reportedThrough, engineWorkType", type: "string" },
      { key: "carImages", type: "{ vinScan?, odometer?, interior?, exterior?: string[] }" },
      { key: "damages", type: "VehicleDamage[]" },
      { key: "demandedRepairs", type: "{ id, description, code, price, customerVoice }[]" },
      { key: "laborDetails", type: "{ id, description, code, price, hours, billableType }[]" },
      { key: "pickupType, pickupAddress, pickupTime, pickupAssociate, pickupRemarks", type: "string" },
      { key: "bayCode, groupCode, technicianName, promisedTime", type: "string" },
      { key: 'paymentMode', type: '\"Cash\" | \"UPI\" | \"Card\"' },
      { key: "taxCustomer, taxInsurance, taxEwr", type: "string" }
    ]
  },
  {
    name: "VehicleDamage",
    desc: "One damage entry on the car schematic",
    fields: [
      { key: "id", type: "string" },
      { key: "part", type: "string (e.g. Hood, Front bumper, Driver Door)" },
      { key: "type", type: '\"SCRATCH\" | \"DENT\" | \"BROKEN\" | \"NOT_FOUND\"' },
      { key: "nodeId", type: "number (maps to CarSchematic node)" }
    ]
  },
  {
    name: "ExistingJobCard",
    desc: "Used in Close Job Card step 0 dropdown — from EXISTING_JOB_CARDS[]",
    fields: [
      { key: "serial, jobCardNo, regNum", type: "number / string" },
      { key: "openingDate, promiseDate", type: "string (DD-MON-YYYY HH:MM)" },
      { key: "customerName, contactNo, model, srvType", type: "string" },
      { key: "status", type: '\"Job Card Opened\" | \"Closed\" | \"CCP purchased\" | ...' },
      { key: "serviceAdvisor, approvalStatus", type: "string" }
    ]
  },
  {
    name: "VehicleHistoryModel",
    desc: "One service record row in the Vehicle History table — from VEHICLE_HISTORIES[]",
    fields: [
      { key: "serial", type: "number" },
      { key: "serviceDate", type: "string (DD-MON-YYYY HH:MM)" },
      { key: "serviceType", type: 'string (e.g. \"3RD FREE SERVICE\")' },
      { key: "mileage", type: "number (KMS)" },
      { key: "dealerDescription", type: "string" },
      { key: "export", type: "boolean" }
    ]
  }
];

export default function FlowViewerPanel() {
  const [activeTab, setActiveTab] = useState<"open" | "close" | "history" | "types">("open");
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({});

  const toggleExpand = (key: string) => {
    setExpandedMap(p => ({ ...p, [key]: !p[key] }));
  };

  const renderSteps = (steps: any[], idPrefix: string) => {
    return (
      <div className="flex flex-col gap-0">
        {steps.map((s, i) => {
          const isLast = i === steps.length - 1;
          const key = idPrefix + '-' + s.step;
          const expanded = expandedMap[key];

          return (
            <div key={key} className="flex gap-0 relative">
              <div className="flex flex-col items-center w-9 shrink-0 relative">
                <div 
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-medium border-2 z-10 shrink-0 mt-2" 
                  style={{ background: s.dotBg, borderColor: s.color, color: s.color }}
                >
                  {s.step + 1}
                </div>
                {!isLast && <div className="w-[1.5px] flex-1 bg-border/80 min-h-[8px]" />}
              </div>
              <div 
                className={`flex-1 ml-3 mb-2.5 p-3 rounded-lg border transition-all cursor-pointer ${expanded ? 'border-[#185FA5] bg-[#E6F1FB] dark:bg-primary/10' : 'border-border bg-card hover:border-primary'}`}
                onClick={() => toggleExpand(key)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[13px] font-medium text-foreground">{s.label}</div>
                    <div className="mt-1">
                      <span className="text-[10px] text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full border border-border">{s.tag}</span>
                    </div>
                  </div>
                  {expanded ? <ChevronDown size={14} className="text-muted-foreground mr-1" /> : <ChevronRight size={14} className="text-muted-foreground mr-1" />}
                </div>

                {expanded && (
                  <div className="mt-2.5 pt-2.5 border-t border-border/50 animate-fade-in flex flex-col gap-3">
                    <div className="flex flex-wrap gap-4">
                      {s.inputs && s.inputs.length > 0 && (
                        <div className="flex-1 min-w-[140px]">
                          <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Inputs</div>
                          <div className="flex flex-wrap gap-1">
                            {s.inputs.map((f: string, j: number) => (
                              <span key={j} className="inline-flex items-center text-[11px] px-2 py-0.5 rounded-full border border-[#185FA5]/30 bg-[#E6F1FB]/50 text-[#0C447C] dark:text-[#3D8EF0] dark:bg-primary/10 dark:border-primary/20">{f}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {s.outputs && s.outputs.length > 0 && (
                        <div className="flex-1 min-w-[140px]">
                          <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Outputs / State changes</div>
                          <div className="flex flex-wrap gap-1">
                            {s.outputs.map((f: string, j: number) => (
                              <span key={j} className="inline-flex items-center text-[11px] px-2 py-0.5 rounded-full border border-border bg-muted text-muted-foreground">{f}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    {s.guard && (
                      <div>
                        <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Guard (Next button)</div>
                        <div className="text-[11px] font-mono text-[#185FA5] dark:text-[#3D8EF0]">{s.guard}</div>
                      </div>
                    )}
                    {s.note && (
                      <div className="text-[11px] text-muted-foreground bg-muted/40 rounded-md p-2 mt-1 border-l-2 border-[#185FA5] leading-relaxed">
                        {s.note}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-background p-4 overflow-y-auto w-full animate-fade-in font-sans">
      <div className="max-w-[800px] w-full mx-auto pb-10">
        
        <div className="flex flex-wrap gap-2 mb-6">
          <button 
            className={`px-4 py-1.5 rounded-md text-[13px] font-medium border transition-colors ${activeTab === 'open' ? 'border-[#185FA5] bg-[#E6F1FB] text-[#0C447C] dark:bg-primary/20 dark:text-primary dark:border-primary' : 'border-border bg-card text-muted-foreground hover:border-primary hover:text-foreground'}`}
            onClick={() => setActiveTab('open')}
          >
            Open Job Card
          </button>
          <button 
            className={`px-4 py-1.5 rounded-md text-[13px] font-medium border transition-colors ${activeTab === 'close' ? 'border-[#185FA5] bg-[#E6F1FB] text-[#0C447C] dark:bg-primary/20 dark:text-primary dark:border-primary' : 'border-border bg-card text-muted-foreground hover:border-primary hover:text-foreground'}`}
            onClick={() => setActiveTab('close')}
          >
            Close Job Card
          </button>
          <button 
            className={`px-4 py-1.5 rounded-md text-[13px] font-medium border transition-colors ${activeTab === 'history' ? 'border-[#185FA5] bg-[#E6F1FB] text-[#0C447C] dark:bg-primary/20 dark:text-primary dark:border-primary' : 'border-border bg-card text-muted-foreground hover:border-primary hover:text-foreground'}`}
            onClick={() => setActiveTab('history')}
          >
            Vehicle History
          </button>
          <button 
            className={`px-4 py-1.5 rounded-md text-[13px] font-medium border transition-colors ${activeTab === 'types' ? 'border-[#185FA5] bg-[#E6F1FB] text-[#0C447C] dark:bg-primary/20 dark:text-primary dark:border-primary' : 'border-border bg-card text-muted-foreground hover:border-primary hover:text-foreground'}`}
            onClick={() => setActiveTab('types')}
          >
            Data Types
          </button>
        </div>

        {activeTab === "open" && (
          <div className="animate-fade-in">
            <div className="flex items-start gap-3 mb-5 pb-4 border-b border-border/50">
              <span className="px-3 py-1 rounded-full text-[11px] font-medium bg-[#E6F1FB] text-[#185FA5] dark:bg-primary/20 dark:text-primary whitespace-nowrap">6 steps</span>
              <div>
                <div className="text-[15px] font-medium text-foreground">Open Job Card Flow</div>
                <div className="text-[12px] text-muted-foreground mt-1 leading-relaxed">activeFlow = "open_job_card" · steps 0–5 · creates a new service job card with customer details, damage audit, repairs, labor, logistics, and signature</div>
              </div>
            </div>
            {renderSteps(OPEN_STEPS, 'open')}
          </div>
        )}

        {activeTab === "close" && (
          <div className="animate-fade-in">
            <div className="flex items-start gap-3 mb-5 pb-4 border-b border-border/50">
              <span className="px-3 py-1 rounded-full text-[11px] font-medium bg-[#EAF3DE] text-[#3B6D11] whitespace-nowrap">6 steps</span>
              <div>
                <div className="text-[15px] font-medium text-foreground">Close Job Card Flow</div>
                <div className="text-[12px] text-muted-foreground mt-1 leading-relaxed">activeFlow = "close_job_card" · steps 0–5 · selects an active job card, allocates bay & technician, verifies odometer + payment, reviews labor, confirms TCS tax, generates invoice</div>
              </div>
            </div>
            {renderSteps(CLOSE_STEPS, 'close')}
          </div>
        )}

        {activeTab === "history" && (
          <div className="animate-fade-in">
            <div className="flex items-start gap-3 mb-5 pb-4 border-b border-border/50">
              <span className="px-3 py-1 rounded-full text-[11px] font-medium bg-[#FAEEDA] text-[#854F0B] whitespace-nowrap">Single view</span>
              <div>
                <div className="text-[15px] font-medium text-foreground">Vehicle History View</div>
                <div className="text-[12px] text-muted-foreground mt-1 leading-relaxed">activeFlow = "vehicle_history" · no sub-steps · lookup past service records by registration plate, with scan support</div>
              </div>
            </div>
            {renderSteps(HISTORY_STEPS, 'history')}
          </div>
        )}

        {activeTab === "types" && (
          <div className="animate-fade-in">
            <div className="flex items-start gap-3 mb-5 pb-4 border-b border-border/50">
              <span className="px-3 py-1 rounded-full text-[11px] font-medium bg-[#F1EFE8] text-[#5F5E5A] whitespace-nowrap dark:bg-muted dark:text-muted-foreground">TypeScript</span>
              <div>
                <div className="text-[15px] font-medium text-foreground">Shared Data Model</div>
                <div className="text-[12px] text-muted-foreground mt-1 leading-relaxed">Key interfaces used across all 3 flows — use as reference when integrating into your own product</div>
              </div>
            </div>
            <div className="flex flex-col gap-4">
              {TYPES_DATA.map(t => (
                <div key={t.name} className="border border-border/70 rounded-lg overflow-hidden bg-card">
                  <div className="p-3 bg-muted/40 border-b border-border/70">
                    <div className="text-[13px] font-medium text-foreground font-mono flex items-center gap-1.5"><Database size={13} className="text-primary" /> {t.name}</div>
                    <div className="text-[11px] text-muted-foreground mt-1">{t.desc}</div>
                  </div>
                  <div className="p-3 bg-card">
                    {t.fields.map((f, i) => (
                      <div key={i} className="flex gap-2 py-1.5 border-b border-border/40 last:border-0 items-baseline">
                        <span className="text-[11px] font-mono text-foreground min-w-[200px] shrink-0 font-medium">{f.key}</span>
                        <span className="text-[11px] font-mono text-[#185FA5] dark:text-[#3D8EF0]">{f.type}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

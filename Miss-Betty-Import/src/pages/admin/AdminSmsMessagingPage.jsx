import { useState } from "react";
import BulkSmsTab from "./BulkSmsTab";
import CustomSmsTab from "./CustomSmsTab";

const TABS = [
  { key: "bulk",   label: "Bulk SMS" },
  { key: "custom", label: "Custom SMS" },
];

export default function AdminSmsMessagingPage() {
  const [activeTab, setActiveTab] = useState("bulk");

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-[-0.4px] text-mbi-navy mb-1">SMS Messaging</h1>
      <p className="text-sm text-mbi-slate mb-4">Send SMS messages to all customers, or to selected customers and/or manually-entered numbers</p>

      <div className="bg-white rounded-mbi-card border border-mbi-hairline p-1 inline-flex gap-1 mb-6">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`text-sm font-semibold px-4 py-2 rounded-lg transition-colors ${
              activeTab === tab.key
                ? "bg-mbi-navy text-white"
                : "text-mbi-slate hover:bg-mbi-surface-soft"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "bulk" ? <BulkSmsTab /> : <CustomSmsTab />}
    </div>
  );
}

import { useState } from "react";
import BulkSmsTab from "./BulkSmsTab";
import IndividualSmsTab from "./IndividualSmsTab";

const TABS = [
  { key: "bulk",       label: "Bulk SMS" },
  { key: "individual", label: "Individual SMS" },
];

export default function AdminSmsMessagingPage() {
  const [activeTab, setActiveTab] = useState("bulk");

  return (
    <div>
      <h1 className="text-xl font-bold text-[#1e2d3d] mb-1">SMS Messaging</h1>
      <p className="text-sm text-gray-400 mb-4">Send SMS messages to all customers or to a single customer</p>

      <div className="bg-white rounded-2xl shadow-sm p-1 inline-flex gap-1 mb-6">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`text-sm font-semibold px-4 py-2 rounded-xl transition-colors ${
              activeTab === tab.key
                ? "bg-[#F2AA25] text-white"
                : "text-gray-400 hover:bg-gray-100"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "bulk" ? <BulkSmsTab /> : <IndividualSmsTab />}
    </div>
  );
}

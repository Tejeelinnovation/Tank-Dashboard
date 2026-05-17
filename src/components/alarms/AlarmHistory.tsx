"use client";

import React, { useState, useEffect, useCallback } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type AlarmHistoryRow = {
  Time: string;
  Tank: string;
  Metric: string;
  Value: number;
  Threshold: number;
  Type: string;
  Unit?: string;
};

export default function AlarmHistory({ slug }: { slug: string }) {
  const [rows, setRows] = useState<AlarmHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/alarms/history?slug=${slug}`);
      const data = await res.json();
      if (data.rows) {
        setRows(data.rows.slice(-100).reverse()); // Show last 100 for display
      }
    } catch (e) {
      console.error("Failed to fetch alarm history", e);
      setError("Failed to load history");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchHistory();
    const interval = setInterval(fetchHistory, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [fetchHistory]);

  const handleExportCSV = () => {
    window.open(`/api/alarms/export?slug=${slug}`, "_blank");
  };

  const handleExportPDF = async () => {
    try {
      const doc = new jsPDF();
      doc.text("Alarm History", 14, 15);
      doc.setFontSize(10);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 22);

      const tableData = rows.map(r => [
        new Date(r.Time).toLocaleString(),
        r.Tank,
        r.Metric,
        `${Number(r.Value).toFixed(4)} ${r.Unit || ""}`,
        r.Type,
        `${Number(r.Threshold).toFixed(4)} ${r.Unit || ""}`
      ]);

      autoTable(doc, {
        head: [['Time', 'Tank', 'Metric', 'Value', 'Type', 'Limit']],
        body: tableData,
        startY: 30,
      });

      doc.save(`alarm_history_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      console.error("PDF Export failed", err);
      alert("Failed to generate PDF");
    }
  };

  return (
    <div className="rounded-3xl border border-black/10 bg-white/70 p-6 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
      <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-black dark:text-white md:text-xl">
            Alarm History
          </h2>
          <p className="mt-1 text-sm text-black/60 dark:text-white/55">
            Past alerts and events.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportCSV}
            className="rounded-xl bg-black/5 px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider text-black transition hover:bg-black/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
          >
            CSV
          </button>
          <button
            onClick={handleExportPDF}
            className="rounded-xl bg-black/5 px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider text-black transition hover:bg-black/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
          >
            PDF
          </button>
        </div>
      </div>

      {loading && rows.length === 0 ? (
        <div className="py-10 text-center text-xs opacity-40">Loading history...</div>
      ) : error ? (
        <div className="py-10 text-center text-xs text-red-500">{error}</div>
      ) : rows.length === 0 ? (
        <div className="py-10 text-center text-xs opacity-40">No history available.</div>
      ) : (
        <div className="space-y-3 overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">
          {rows.map((row, i) => (
            <div
              key={i}
              className="flex flex-col gap-1 border-b border-black/5 pb-3 last:border-b-0 last:pb-0 dark:border-white/5 text-[11px]"
            >
              <div className="flex justify-between items-start">
                <span className="font-semibold text-black/80 dark:text-white/80">
                  {row.Tank} — <span className={row.Type === 'max' ? 'text-red-500' : 'text-orange-500'}>{row.Metric} {row.Type}</span>
                </span>
                <span className="opacity-40 text-[9px]">
                  {new Date(row.Time).toLocaleString()}
                </span>
              </div>
              <div className="opacity-60 flex justify-between">
                <span>Value: {Number(row.Value).toFixed(2)} {row.Unit}</span>
                <span>Limit: {Number(row.Threshold).toFixed(2)} {row.Unit}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

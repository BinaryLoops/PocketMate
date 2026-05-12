"use client";

import { useState } from "react";
import { useApp } from "@/hooks/use-app";
import type { Transaction } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const PdfExport = () => {
  const { user, profile, goals, transactions } = useApp();
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);

  // Format currency in Indian Rupees
  const formatINR = (amount: number) => {
    const formatted = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
    // Ensure proper spacing after ₹ symbol and use thin space for thousands
    return formatted.replace(/₹\s?/, '₹ ').replace(/,/g, ',');
  };

  // Compute financial metrics
  const computeMetrics = () => {
    if (!profile) return null;

    const monthlyNeeds = profile.fixedExpenses.reduce(
      (sum, expense) => sum + expense.amount,
      0
    );
    const disposable = Math.max(profile.income - monthlyNeeds, 0);
    const wants = disposable * 0.6;
    const savings = disposable * 0.4;
    const dailyLimit = wants / 30;

    // Calculate emergency fund progress
    const emergencyFundProgress = (profile.emergencyFund.current / profile.emergencyFund.target) * 100;

    // Get totals by category
    const categoryTotals = profile.fixedExpenses.reduce((acc, expense) => {
      acc[expense.category] = (acc[expense.category] || 0) + expense.amount;
      return acc;
    }, {} as Record<string, number>);

    return {
      monthlyNeeds,
      disposable,
      wants,
      savings,
      dailyLimit,
      fixedCount: profile.fixedExpenses.length,
      emergencyFund: profile.emergencyFund,
      emergencyFundProgress,
      categoryTotals,
    };
  };

  // Generate actionable insights and detailed analysis
  const generateInsights = (metrics: ReturnType<typeof computeMetrics>) => {
    if (!metrics || !profile) return [];
    
    const insights = [];
    const needsRatio = metrics.monthlyNeeds / profile.income;
    
    // Budget Health
    if (needsRatio > 0.5) {
      insights.push(`Your fixed expenses (${formatINR(metrics.monthlyNeeds)}) represent ${(needsRatio * 100).toFixed(1)}% of your income. Consider reviewing non-essential fixed expenses.`);
    }

    // Emergency Fund
    const emergencyMonths = metrics.emergencyFund.current / (profile.income / 12);
    if (metrics.emergencyFundProgress < 100) {
      insights.push(`Emergency fund is at ${metrics.emergencyFundProgress.toFixed(1)}% of target. Currently covers ${emergencyMonths.toFixed(1)} months of expenses. Aim for 6 months coverage.`);
    }

    // Savings Rate
    const savingsRate = (metrics.savings / profile.income) * 100;
    if (savingsRate < 20) {
      insights.push(`Your savings rate is ${savingsRate.toFixed(1)}%. Consider increasing monthly savings by ${formatINR(profile.income * 0.2 - metrics.savings)}.`);
    }

    // Category Analysis
    const highestCategory = Object.entries(metrics.categoryTotals)
      .sort(([,a], [,b]) => b - a)[0];
    if (highestCategory) {
      insights.push(`Your highest expense category is ${highestCategory[0]} at ${formatINR(highestCategory[1])}. Review if this aligns with your financial goals.`);
    }

    // Daily Spending
    if (metrics.dailyLimit < profile.income * 0.001) {
      insights.push(`Your daily spending limit of ${formatINR(metrics.dailyLimit)} is quite restrictive. Consider reviewing your budget allocation.`);
    }

    return insights;
  };

  const handleExport = async () => {
    try {
      setIsExporting(true);
      if (!profile || !user) {
        throw new Error("Missing user or profile data");
      }

      const metrics = computeMetrics();
      if (!metrics) {
        throw new Error("Could not compute financial metrics");
      }

      // Initialize PDF
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;
      
      // Header with better spacing and styling
      doc.setFontSize(24);
      doc.setTextColor(41, 37, 36);
      doc.text("PocketMate Financial Report", pageWidth / 2, 25, { align: "center" });
      
      // Underline the title
      const titleWidth = doc.getTextWidth("PocketMate Financial Report");
      doc.setLineWidth(0.5);
      doc.line(pageWidth / 2 - titleWidth / 2, 28, pageWidth / 2 + titleWidth / 2, 28);
      
      doc.setFontSize(11);
      doc.setTextColor(71, 71, 71);
      const currentDate = new Date().toLocaleDateString('en-IN', { 
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      });
      const period = new Date().toLocaleDateString('en-IN', { 
        month: 'long',
        year: 'numeric'
      });
      doc.text(`Generated: ${currentDate}`, 20, 40);
      doc.text(`Report Period: ${period}`, 20, 47);
      doc.text(`User: ${user.email}`, 20, 54);

      // Summary Box with enhanced styling
      const summaryBoxY = 65;
      doc.setFillColor(247, 247, 247);
      doc.setDrawColor(230, 230, 230);
      doc.roundedRect(20, summaryBoxY, pageWidth - 40, 65, 3, 3, 'FD');
      
      doc.setFontSize(14);
      doc.setTextColor(41, 37, 36);
      doc.text("Financial Summary", pageWidth / 2, summaryBoxY + 15, { align: "center" });
      
      // Add a subtle line under the summary title
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.2);
      doc.line(40, summaryBoxY + 18, pageWidth - 40, summaryBoxY + 18);
      
      doc.setFontSize(10);
      doc.setTextColor(71, 71, 71);
      
      const summaryData = [
        ["Monthly Income:", formatINR(profile.income)],
        ["Fixed Expenses:", formatINR(metrics.monthlyNeeds)],
        ["Available for Wants:", formatINR(metrics.wants)],
        ["Recommended Savings:", formatINR(metrics.savings)],
        ["Daily Spending Limit:", formatINR(metrics.dailyLimit)],
        ["Emergency Fund Target:", formatINR(metrics.emergencyFund.target)],
        ["Emergency Fund Current:", formatINR(metrics.emergencyFund.current)],
      ];

      let yPos = 70;
      summaryData.forEach(([label, value]) => {
        doc.text(label, 30, yPos);
        doc.text(value, pageWidth - 60, yPos);
        yPos += 6;
      });

      // Fixed Expenses Table
      doc.setFontSize(14);
      doc.text("Fixed Expenses", pageWidth / 2, 110, { align: "center" });

      const tableData = profile.fixedExpenses.map((expense, index) => [
        (index + 1).toString(),
        expense.name,
        expense.category,
        formatINR(expense.amount),
        expense.timelineMonths?.toString() || 'N/A',
        expense.startDate ? new Date(expense.startDate).toLocaleDateString() : 'N/A',
      ]);

      autoTable(doc, {
        startY: 120,
        head: [["#", "Name", "Category", "Amount", "Months", "Start Date"]],
        body: tableData,
        theme: "grid",
        headStyles: { 
          fillColor: [41, 37, 36],
          fontSize: 10,
          halign: 'center'
        },
        columnStyles: {
          0: { cellWidth: 15 },
          1: { cellWidth: 'auto' },
          2: { cellWidth: 'auto' },
          3: { cellWidth: 40, halign: 'right' },
          4: { cellWidth: 30, halign: 'center' },
          5: { cellWidth: 40, halign: 'center' }
        },
        styles: {
          fontSize: 9,
          cellPadding: 3,
        },
        margin: { top: 120 },
      });

      // Financial Goals Section
      let finalY = (doc as any).lastAutoTable.finalY || 120;
      
      doc.setFontSize(14);
      doc.text("Financial Goals Progress", pageWidth / 2, finalY + 20, { align: "center" });
      
      const goalData = goals?.map(goal => [
        goal.name,
        formatINR(goal.targetAmount),
        formatINR(goal.currentAmount),
        `${((goal.currentAmount / goal.targetAmount) * 100).toFixed(1)}%`,
        formatINR(goal.monthlyContribution),
        goal.timelineMonths + " months",
      ]) || [];

      if (goalData.length > 0) {
        autoTable(doc, {
          startY: finalY + 30,
          head: [["Goal", "Target", "Current", "Progress", "Monthly", "Timeline"]],
          body: goalData,
          theme: "grid",
          headStyles: { fillColor: [41, 37, 36] },
        });

        finalY = (doc as any).lastAutoTable.finalY;
      }

      // Recent Transactions Section
      doc.setFontSize(14);
      doc.text("Recent Transactions", pageWidth / 2, finalY + 20, { align: "center" });

      const recentTransactions = transactions
        ?.slice(-5)
        .map((tx: Transaction) => [
          new Date(tx.date).toLocaleDateString(),
          tx.description,
          tx.category,
          formatINR(tx.amount),
        ]) || [];

      if (recentTransactions.length > 0) {
        autoTable(doc, {
          startY: finalY + 30,
          head: [["Date", "Description", "Category", "Amount"]],
          body: recentTransactions,
          theme: "grid",
          headStyles: { fillColor: [41, 37, 36] },
        });

        finalY = (doc as any).lastAutoTable.finalY;
      }

      // Emergency Fund History
      doc.setFontSize(14);
      doc.text("Emergency Fund History", pageWidth / 2, finalY + 20, { align: "center" });

      const fundHistory = profile.emergencyFund.history
        .slice(-5)
        .map(entry => [
          new Date(entry.date).toLocaleDateString(),
          entry.type,
          formatINR(entry.amount),
          entry.notes || "-"
        ]);

      if (fundHistory.length > 0) {
        autoTable(doc, {
          startY: finalY + 30,
          head: [["Date", "Type", "Amount", "Notes"]],
          body: fundHistory,
          theme: "grid",
          headStyles: { 
            fillColor: [41, 37, 36],
            fontSize: 10,
            halign: 'center'
          },
          columnStyles: {
            0: { cellWidth: 40, halign: 'center' },
            1: { cellWidth: 30, halign: 'center' },
            2: { cellWidth: 40, halign: 'right' },
            3: { cellWidth: 'auto' }
          },
          styles: {
            fontSize: 9,
            cellPadding: 3,
          },
          alternateRowStyles: {
            fillColor: [252, 252, 252]
          },
        });

        finalY = (doc as any).lastAutoTable.finalY;
      }

      // Insights with better formatting
      const insights = generateInsights(metrics);
      
      doc.setFontSize(14);
      doc.setTextColor(41, 37, 36);
      doc.text("Financial Insights & Recommendations", pageWidth / 2, finalY + 25, { align: "center" });
      
      // Add a subtle line under the insights title
      const insightsTitleWidth = doc.getTextWidth("Financial Insights & Recommendations");
      doc.setLineWidth(0.2);
      doc.setDrawColor(200, 200, 200);
      doc.line(pageWidth / 2 - insightsTitleWidth / 2, finalY + 28, 
               pageWidth / 2 + insightsTitleWidth / 2, finalY + 28);
      
      let insightY = finalY + 40;
      doc.setFontSize(10);
      doc.setTextColor(71, 71, 71);
      
      insights.forEach((insight) => {
        // Split long insights into multiple lines
        const maxWidth = pageWidth - 45; // Leave space for bullet point
        const lines = doc.splitTextToSize(`• ${insight}`, maxWidth);
        
        lines.forEach((line: string) => {
          doc.text(line, 20, insightY);
          insightY += 12;
        });
        
        // Add extra space between insights
        insightY += 3;
      });

      // Footer
      const pageCount = (doc as any).internal.getNumberOfPages();
      doc.setFontSize(8);
      for (let i = 1; i <= pageCount; i++) {
        (doc as any).setPage(i);
        doc.text(
          "PocketMate - Confidential",
          pageWidth / 2,
          doc.internal.pageSize.height - 10,
          { align: "center" }
        );
      }

      // Save the PDF
      const fileName = `pocketmate_report_${new Date().toISOString().slice(0, 7)}.pdf`;
      doc.save(fileName);

      toast({
        title: "Success",
        description: "Financial report exported successfully",
      });
    } catch (error) {
      console.error("PDF export error:", error);
      toast({
        title: "Export Failed",
        description: "Could not generate the PDF report. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="secondary" size="sm" disabled={isExporting}>
          {isExporting ? "Exporting..." : "Export PDF Report"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Export Financial Report</AlertDialogTitle>
          <AlertDialogDescription>
            This will generate a PDF containing your financial data and insights.
            The report includes your income, expenses, and financial metrics.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleExport}>
            Export PDF
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default PdfExport;
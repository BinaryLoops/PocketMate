"use client";

import React from 'react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useApp } from '@/hooks/use-app';
import { buildOrganizedReport, toJsonBlob, transactionsToCsv, downloadBlob } from '@/lib/exportReport';

export function ExportReport() {
  const { profile, transactions, goals } = useApp();

  const onExportJson = () => {
    const report = buildOrganizedReport({ profile, transactions, goals });
    const blob = toJsonBlob(report);
    downloadBlob(blob, `pocketmate-report-${new Date().toISOString()}.json`);
  };

  const onExportCsv = () => {
    const report = buildOrganizedReport({ profile, transactions, goals });
    const csv = transactionsToCsv(report.transactions || []);
    const blob = new Blob([csv], { type: 'text/csv' });
    downloadBlob(blob, `pocketmate-transactions-${new Date().toISOString()}.csv`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">Export</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={onExportJson}>Export full report (JSON)</DropdownMenuItem>
        <DropdownMenuItem onClick={onExportCsv}>Export transactions (CSV)</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default ExportReport;

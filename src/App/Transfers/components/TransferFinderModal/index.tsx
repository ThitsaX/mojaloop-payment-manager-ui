import React, { FC, useState, useEffect, useCallback, useRef } from 'react';
import { connect } from 'react-redux';
import { State, Dispatch } from 'store/types';
import { AliasType, TransferDirection, TransferStatus } from 'App/types';
import {
  DataLabel,
  Link,
  ErrorBox,
  Modal,
  FormInput,
  Select,
  Spinner,
  Tabs,
  Tab,
  TabList,
  TabPanels,
  TabPanel,
  Button,
  PaginatedTable,
  MessageBox,
  CursorPagination,
} from 'components';
import xlsx from 'xlsx';
import JSZip from 'jszip';
import axios from 'axios';
import * as actions from '../../actions';
import * as selectors from '../../selectors';
import { Transfer, TransferError, TransferFilter, DisputeFilter, DateRange } from '../../types';
import * as helpers from '../../helpers';

type FilterChangeValue = string | number;

const stateProps = (state: State) => ({
  model: selectors.getTransferFinderFilter(state),
  transfers: selectors.getTransfers(state),
  transfersError: selectors.getTransfersError(state),
  isTransfersPending: selectors.getIsTransfersPending(state),
  isTransfersRequested: selectors.getIsTransfersRequested(state),
  transfersCount: selectors.getTransfersCount(state),
  isTransfersCountPending: selectors.getIsTransfersCountPending(state),
  transfersNextCursor: selectors.getTransfersNextCursor(state),
  transfersHasMore: selectors.getTransfersHasMore(state),
  apiBaseUrl: state.app.config.apiBaseUrl,
  disputeModel: selectors.getDisputeFilter(state),
  isDisputeRequested: selectors.getIsDisputeRequested(state),
  disputeTransactions: selectors.getDisputeTransactions(state),
  disputeTransactionsError: selectors.getDisputeTransactionsError(state),
  isDisputeTransactionsPending: selectors.getIsDisputeTransactionsPending(state),
  disputeTransactionsCount: selectors.getDisputeTransactionsCount(state),
  isDisputeTransactionsCountPending: selectors.getIsDisputeTransactionsCountPending(state),
  disputeTransactionsNextCursor: selectors.getDisputeTransactionsNextCursor(state),
  disputeTransactionsHasMore: selectors.getDisputeTransactionsHasMore(state),
});

const dispatchProps = (dispatch: Dispatch) => ({
  onModalCloseClick: () => dispatch(actions.toggleTransferFinderModal()),
  onFiltersSubmitClick: (filters: TransferFilter, pagination?: { cursor?: string; limit: number }) =>
    dispatch(actions.requestTransfers({ filters, pagination })),
  onTransfersSubmitClick: () => dispatch(actions.unrequestTransfers()),
  onFilterChange: ({ field, value }: { field: string; value: FilterChangeValue }) =>
    dispatch(actions.setTransferFinderFilter({ field, value })),
  onTransferRowClick: (transferError: TransferError) => {
    dispatch(actions.requestTransferDetails({ transferId: transferError.id }));
  },
  onRequestTransfersCount: (filters: TransferFilter) =>
    dispatch(actions.requestTransfersCount({ filters })),
  onDisputeFilterChange: ({ field, value }: { field: string; value: FilterChangeValue }) =>
    dispatch(actions.setDisputeFilter({ field, value })),
  onDisputeFiltersSubmitClick: (filters: DisputeFilter, pagination?: { cursor?: string; limit: number }) =>
    dispatch(actions.requestDisputeTransactions({ filters, pagination })),
  onDisputeTransactionsSubmitClick: () => dispatch(actions.unrequestDisputeTransactions()),
  onRequestDisputeTransactionsCount: (filters: DisputeFilter) =>
    dispatch(actions.requestDisputeTransactionsCount({ filters })),
});

interface TransferFinderModalProps {
  model: TransferFilter;
  transfers: Transfer[];
  transfersError: string | null;
  isTransfersPending: boolean;
  isTransfersRequested: boolean;
  transfersCount: number;
  isTransfersCountPending: boolean;
  transfersNextCursor?: string;
  transfersHasMore?: boolean;
  apiBaseUrl: string;
  onFiltersSubmitClick: (filters: TransferFilter, pagination?: { cursor?: string; limit: number }) => void;
  onTransfersSubmitClick: () => void;
  onModalCloseClick: () => void;
  onFilterChange: ({ field, value }: { field: string; value: FilterChangeValue }) => void;
  onTransferRowClick: (transferError: TransferError) => void;
  onRequestTransfersCount: (filters: TransferFilter) => void;
  disputeModel: DisputeFilter;
  isDisputeRequested: boolean;
  disputeTransactions: Transfer[];
  disputeTransactionsError: string | null;
  isDisputeTransactionsPending: boolean;
  disputeTransactionsCount: number;
  isDisputeTransactionsCountPending: boolean;
  disputeTransactionsNextCursor?: string;
  disputeTransactionsHasMore?: boolean;
  onDisputeFilterChange: ({ field, value }: { field: string; value: FilterChangeValue }) => void;
  onDisputeFiltersSubmitClick: (filters: DisputeFilter, pagination?: { cursor?: string; limit: number }) => void;
  onDisputeTransactionsSubmitClick: () => void;
  onRequestDisputeTransactionsCount: (filters: DisputeFilter) => void;
}

function buildTransferApiUrl(filters: TransferFilter, cursor: string | undefined, limit: number, apiBaseUrl: string): string {
  const baseUrl = `${apiBaseUrl}/transfers`;
  const params = new URLSearchParams();

  if (filters.transferId) {
    params.append('id', String(filters.transferId));
  } else {
    if (filters.from) params.append('startTimestamp', new Date(filters.from as number).toISOString());
    if (filters.to) params.append('endTimestamp', new Date(filters.to as number).toISOString());
    if (filters.aliasType) params.append('recipientIdType', String(filters.aliasType));
    if (filters.payeeAlias) params.append('recipientIdValue', String(filters.payeeAlias));
    if (filters.aliasSubValue) params.append('recipientIdSubValue', String(filters.aliasSubValue));
    if (filters.direction) params.append('direction', String(filters.direction));
    if (filters.institution) params.append('institution', String(filters.institution));
    if (filters.status) params.append('status', String(filters.status));
  }

  if (cursor) params.append('cursor', cursor);
  params.append('limit', limit.toString());

  const fullUrl = `${baseUrl}?${params.toString()}`;
  console.log('Chunked download API URL:', fullUrl); // Debug log
  return fullUrl;
}

function buildDisputeApiUrl(filters: DisputeFilter, cursor: string | undefined, limit: number, apiBaseUrl: string): string {
  const baseUrl = `${apiBaseUrl}/transfers/dispute`;
  const params = new URLSearchParams();

  if (filters.from) params.append('startTimestamp', new Date(filters.from as number).toISOString());
  if (filters.to) params.append('endTimestamp', new Date(filters.to as number).toISOString());
  if (filters.direction && filters.direction !== TransferDirection.All) params.append('direction', String(filters.direction));
  if (filters.currency && filters.currency !== 'ALL') params.append('currency', String(filters.currency));

  if (cursor) params.append('cursor', cursor);
  params.append('limit', limit.toString());

  return `${baseUrl}?${params.toString()}`;
}

// Helper function to fetch transfers data using cursor-based pagination
// Returns both the data and the next cursor for sequential iteration
async function fetchTransferChunk(
  filters: TransferFilter,
  cursor: string | undefined,
  limit: number,
  apiBaseUrl: string,
  maxRetries: number = 2,
  progressCallback?: (stage: string) => void
): Promise<{ transfers: any[]; nextCursor?: string; hasMore?: boolean }> {
  let retryCount = 0;

  while (retryCount <= maxRetries) {
    try {
      // Use cursor-based pagination for consistent, sequential downloads
      const url = buildTransferApiUrl(filters, cursor, limit, apiBaseUrl);

      const response = await axios({
        method: 'get',
        url,
        headers: {
          'Content-Type': 'application/json',
        },
        withCredentials: true,
        validateStatus: () => true,
      });

      if (response.status < 200 || response.status >= 300) {
        // Check if this is a retryable error (401, 502, 503, 504, network errors)
        if ((response.status === 401 || response.status === 502 || response.status === 503 || response.status === 504) && retryCount < maxRetries) {
          retryCount++;
          if (progressCallback) {
            progressCallback(`Retrying chunk (cursor: ${cursor || 'initial'}) - attempt ${retryCount}/${maxRetries}`);
          }
          // Exponential backoff: wait 1s, then 2s
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount - 1) * 1000));
          continue;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Extract transfers array and pagination metadata from API response
      const responseData = response.data;
      return {
        transfers: responseData.transfers || responseData,
        nextCursor: responseData.nextCursor,
        hasMore: responseData.hasMore
      };
    } catch (error) {
      // Network errors or other exceptions
      if (retryCount < maxRetries && (error.code === 'NETWORK_ERROR' || error.message.includes('401') || error.message.includes('502') || error.message.includes('503') || error.message.includes('504'))) {
        retryCount++;
        if (progressCallback) {
          progressCallback(`Retrying chunk (cursor: ${cursor || 'initial'}) - attempt ${retryCount}/${maxRetries}`);
        }
        // Exponential backoff: wait 1s, then 2s
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount - 1) * 1000));
        continue;
      }
      throw new Error(`Failed to fetch chunk (cursor: ${cursor || 'initial'}): ${error.message}`);
    }
  }

  throw new Error(`Failed to fetch chunk (cursor: ${cursor || 'initial'}) after ${maxRetries} retries`);
}

// Helper function to generate Excel file for a chunk
function generateExcelFileForChunk(
  transfers: any[],
  chunkIndex: number,
  dateFormat: 'iso' | 'readable' = 'iso'
): { filename: string; content: ArrayBuffer } {
  // Format dates in transfer data before creating Excel
  const formattedTransfers = transfers.map(transfer => ({
    ...transfer,
    initiatedTimestamp: transfer.initiatedTimestamp
      ? helpers.toTransfersDate(transfer.initiatedTimestamp, dateFormat)
      : transfer.initiatedTimestamp
  }));

  const ws = xlsx.utils.json_to_sheet(formattedTransfers);
  const wscols = [{ wch: 20 }];
  ws['!cols'] = wscols;
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, 'Transfers');

  const filename = `Payment_Manager_Transfers_Part${chunkIndex.toString().padStart(2, '0')}.xlsx`;
  const content = xlsx.write(wb, { bookType: 'xlsx', type: 'array' });

  return { filename, content };
}

// Helper function to create and download ZIP file
async function downloadZipFile(
  files: { filename: string; content: ArrayBuffer }[]
): Promise<void> {
  const zip = new JSZip();

  // Add all files to ZIP
  files.forEach(file => {
    zip.file(file.filename, file.content);
  });

  // Generate ZIP file
  const zipContent = await zip.generateAsync({ type: 'blob' });

  // Create download link
  const url = window.URL.createObjectURL(zipContent);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Payment_Manager_Transfers_${new Date().toISOString().split('T')[0]}.zip`;

  // Trigger download
  document.body.appendChild(link);
  link.click();

  // Cleanup
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

// Legacy single-page download function (kept for backward compatibility)
async function downloadTransfersToExcel(
  transfers: any,
  dateFormat: 'iso' | 'readable' = 'iso'
): Promise<void> {
  // Format dates in transfer data before creating Excel
  const formattedTransfers = transfers.map((transfer: any) => ({
    ...transfer,
    initiatedTimestamp: transfer.initiatedTimestamp
      ? helpers.toTransfersDate(transfer.initiatedTimestamp, dateFormat)
      : transfer.initiatedTimestamp
  }));

  const ws = xlsx.utils.json_to_sheet(formattedTransfers);
  const wscols = [{ wch: 20 }];
  ws['!cols'] = wscols;
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, 'Transfers');
  const fileName: string = `Payment_Manager_Transfers_${new Date().toDateString()}.xlsx`;
  xlsx.writeFile(wb, fileName);
}

// Generates a formatted Dispute Transaction Report Excel workbook.
// partNumber is 1-based (for chunked ZIP downloads); startRowNumber is 0-based offset for the "No." column.
function generateDisputeReportExcel(
  transfers: any[],
  filters: DisputeFilter,
  partNumber?: number,
  startRowNumber: number = 0
): { filename: string; content: ArrayBuffer } {
  const wb = xlsx.utils.book_new();
  const ws: xlsx.WorkSheet = {};

  const fromDate = filters.from ? new Date(filters.from as number).toISOString() : '';
  const toDate = filters.to ? new Date(filters.to as number).toISOString() : '';

  const thinBorder = {
    top: { style: 'thin', color: { rgb: '000000' } },
    bottom: { style: 'thin', color: { rgb: '000000' } },
    left: { style: 'thin', color: { rgb: '000000' } },
    right: { style: 'thin', color: { rgb: '000000' } },
  };
  // Partial borders for cells inside a merged row (only top+bottom on inner cells, add left on first, right on last)
  const mergeLeftBorder = { top: thinBorder.top, bottom: thinBorder.bottom, left: thinBorder.left };
  const mergeMidBorder = { top: thinBorder.top, bottom: thinBorder.bottom };
  const mergeRightBorder = { top: thinBorder.top, bottom: thinBorder.bottom, right: thinBorder.right };

  const titleStyle = { font: { name: 'Calibri', sz: 11, bold: true }, alignment: { horizontal: 'left' }, border: mergeLeftBorder };
  const labelStyle = { font: { name: 'Calibri', sz: 11 }, alignment: { horizontal: 'left' }, border: mergeLeftBorder };
  const headerStyle = { font: { name: 'Calibri', sz: 11, bold: true }, alignment: { horizontal: 'left' }, border: thinBorder };
  const textStyle = { font: { name: 'Calibri', sz: 11 }, alignment: { horizontal: 'left' }, border: thinBorder };
  const numStyle = { font: { name: 'Calibri', sz: 11 }, alignment: { horizontal: 'right' }, border: thinBorder };
  const amountStyle = { font: { name: 'Calibri', sz: 11 }, alignment: { horizontal: 'right' }, border: thinBorder };

  const COLS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

  // Row 1 – Report title (merged A1:L1)
  ws['A1'] = { v: 'Dispute Report', t: 's', s: titleStyle };
  COLS.slice(1, -1).forEach(col => { ws[`${col}1`] = { v: '', t: 's', s: { border: mergeMidBorder } }; });
  ws['L1'] = { v: '', t: 's', s: { border: mergeRightBorder } };

  // Row 2 – Report period (merged A2:L2)
  ws['A2'] = { v: `Report Period: ${fromDate} to ${toDate}`, t: 's', s: labelStyle };
  COLS.slice(1, -1).forEach(col => { ws[`${col}2`] = { v: '', t: 's', s: { border: mergeMidBorder } }; });
  ws['L2'] = { v: '', t: 's', s: { border: mergeRightBorder } };

  // Row 3 – empty (spacer)

  // Row 4 – Column headers
  const HEADERS = [
    'No.', 'Transaction ID', 'Direction', 'Currency', 'Amount',
    'Sender', 'Sender ID Type', 'Sender ID Value',
    'Receiver', 'Receiver ID Type', 'Receiver ID Value', 'Error',
  ];
  COLS.forEach((col, i) => {
    ws[`${col}4`] = { v: HEADERS[i], t: 's', s: headerStyle };
  });

  // Rows 5+ – Data
  transfers.forEach((t, idx) => {
    const row = idx + 5;
    ws[`A${row}`] = { v: startRowNumber + idx + 1, t: 'n', z: '#,##0', s: numStyle };
    ws[`B${row}`] = { v: t.id || '', t: 's', s: textStyle };
    ws[`C${row}`] = { v: t.direction || '', t: 's', s: textStyle };
    ws[`D${row}`] = { v: t.currency || '', t: 's', s: textStyle };
    ws[`E${row}`] = { v: typeof t.amount === 'number' ? t.amount : (parseFloat(t.amount) || 0), t: 'n', z: '#,##0.00', s: amountStyle };
    ws[`F${row}`] = { v: t.sender || '', t: 's', s: textStyle };
    ws[`G${row}`] = { v: t.senderIdType || '', t: 's', s: textStyle };
    ws[`H${row}`] = { v: t.senderIdValue || '', t: 's', s: textStyle };
    ws[`I${row}`] = { v: t.recipient || '', t: 's', s: textStyle };
    ws[`J${row}`] = { v: t.recipientIdType || '', t: 's', s: textStyle };
    ws[`K${row}`] = { v: t.recipientIdValue || '', t: 's', s: textStyle };
    ws[`L${row}`] = { v: t.lastError ? (typeof t.lastError === 'string' ? t.lastError : JSON.stringify(t.lastError)) : '', t: 's', s: textStyle };
  });

  const lastRow = Math.max(4, transfers.length + 4);
  ws['!ref'] = `A1:L${lastRow}`;
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 11 } }, // A1:L1 – title
    { s: { r: 1, c: 0 }, e: { r: 1, c: 11 } }, // A2:L2 – report period
  ];
  ws['!cols'] = [
    { wch: 8 },  // No.
    { wch: 38 }, // Transaction ID
    { wch: 12 }, // Direction
    { wch: 10 }, // Currency
    { wch: 18 }, // Amount
    { wch: 25 }, // Sender
    { wch: 18 }, // Sender ID Type
    { wch: 25 }, // Sender ID Value
    { wch: 25 }, // Receiver
    { wch: 18 }, // Receiver ID Type
    { wch: 25 }, // Receiver ID Value
    { wch: 40 }, // Error
  ];

  xlsx.utils.book_append_sheet(wb, ws, 'Dispute Transaction List');

  const dateStr = new Date().toISOString().split('T')[0];
  const filename = partNumber
    ? `Dispute_Report_Part${String(partNumber).padStart(2, '0')}.xlsx`
    : `Dispute_Report_${dateStr}.xlsx`;

  const content = xlsx.write(wb, { bookType: 'xlsx', type: 'array', cellStyles: true });
  return { filename, content };
}

async function downloadDisputeReportSingleFile(
  transfers: any[],
  filters: DisputeFilter
): Promise<void> {
  const { filename, content } = generateDisputeReportExcel(transfers, filters);
  const blob = new Blob([content], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

const TransferFinderModal: FC<TransferFinderModalProps> = ({
  model,
  transfers,
  transfersError,
  isTransfersPending,
  isTransfersRequested,
  transfersCount,
  isTransfersCountPending,
  transfersNextCursor,
  transfersHasMore,
  apiBaseUrl,
  onFiltersSubmitClick,
  onTransfersSubmitClick,
  onModalCloseClick,
  onFilterChange,
  onTransferRowClick,
  onRequestTransfersCount,
  disputeModel,
  isDisputeRequested,
  disputeTransactions,
  disputeTransactionsError,
  isDisputeTransactionsPending,
  disputeTransactionsCount,
  isDisputeTransactionsCountPending,
  disputeTransactionsNextCursor,
  disputeTransactionsHasMore,
  onDisputeFilterChange,
  onDisputeFiltersSubmitClick,
  onDisputeTransactionsSubmitClick,
  onRequestDisputeTransactionsCount,
}) => {
  const [pagination, setPagination] = useState<{ cursor?: string; limit: number }>({ cursor: undefined, limit: 20 });
  const [cursorHistory, setCursorHistory] = useState<(string | undefined)[]>([undefined]); // Stack of cursors for backward navigation
  const [currentPageIndex, setCurrentPageIndex] = useState(0); // Track current page position
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isDownloadingExcel, setIsDownloadingExcel] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState({ current: 0, total: 0, stage: 'Initializing...' });
  const [downloadCancelled, setDownloadCancelled] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [dateFormat, setDateFormat] = useState<'iso' | 'readable'>('iso');
  const [dateRangeError, setDateRangeError] = useState<string | null>(null);
  const [activeMode, setActiveMode] = useState<'transfers' | 'dispute' | null>(null);
  const [activeFilterTab, setActiveFilterTab] = useState(0); // 0=Basic, 1=Advanced, 2=Dispute
  // Dispute pagination state
  const [disputePagination, setDisputePagination] = useState<{ cursor?: string; limit: number }>({ cursor: undefined, limit: 20 });
  const [disputeCursorHistory, setDisputeCursorHistory] = useState<(string | undefined)[]>([undefined]);
  const [disputePageIndex, setDisputePageIndex] = useState(0);
  const [disputeDateRangeError, setDisputeDateRangeError] = useState<string | null>(null);
  const [isDisputeDownloadingExcel, setIsDisputeDownloadingExcel] = useState(false);
  const [disputeDownloadProgress, setDisputeDownloadProgress] = useState({ current: 0, total: 0, stage: 'Initializing...' });
  const [disputeDownloadCancelled, setDisputeDownloadCancelled] = useState(false);
  const [disputeDownloadError, setDisputeDownloadError] = useState<string | null>(null);
  const disputeDownloadCancelledRef = useRef<boolean>(false);
  const maxRetries = 2;
  const MAX_DOWNLOAD_LIMIT = 20000;
  const MAX_DATE_RANGE_DAYS = 32; // 1 month maximum (31 days + endOf day time component)
  const RECORDS_PER_FILE = 2500; // Max records per Excel file in ZIP
  const DOWNLOAD_CHUNK_SIZE = 1000; // Records to fetch per API call during download (not used yet, but planned)
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastRequestParamsRef = useRef<{ filters: TransferFilter; pagination?: { cursor?: string; limit: number } } | null>(null);
  const downloadCancelledRef = useRef<boolean>(false);

  useEffect(() => {
    if (isTransfersRequested) {
      onRequestTransfersCount(model);
    }
  }, [isTransfersRequested, model, onRequestTransfersCount]);

  useEffect(() => {
    if (isDisputeRequested) {
      onRequestDisputeTransactionsCount(disputeModel);
    }
  }, [isDisputeRequested, disputeModel, onRequestDisputeTransactionsCount]);

  // Auto-retry when there's an error
  useEffect(() => {
    if (transfersError && !isTransfersPending && retryCount < maxRetries && lastRequestParamsRef.current && !isRetrying) {
      setIsRetrying(true);
      retryTimeoutRef.current = setTimeout(() => {
        setRetryCount(prev => prev + 1);
        const { filters, pagination: retryPagination } = lastRequestParamsRef.current!;
        onFiltersSubmitClick(filters, retryPagination);
      }, 1000); // Wait 1 second before retry
    }
  }, [transfersError, isTransfersPending, retryCount, maxRetries, onFiltersSubmitClick, isRetrying]);

  // Reset retry state when request completes successfully or max retries reached
  useEffect(() => {
    if (!transfersError && !isTransfersPending && retryCount > 0) {
      setRetryCount(0);
      setIsRetrying(false);
    }
    if (retryCount >= maxRetries) {
      setIsRetrying(false);
    }
  }, [transfersError, isTransfersPending, retryCount, maxRetries]);

  // Cleanup timeout
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);
  const handlePageChange = (direction: 'next' | 'previous' | 'pageSize', newLimit?: number) => {
    const limit = newLimit || pagination.limit;

    if (direction === 'next') {
      // Going forward
      const newCursor = transfersNextCursor;
      const newPageIndex = currentPageIndex + 1;

      // Add new cursor to history if we're moving to a new page
      if (newPageIndex === cursorHistory.length) {
        setCursorHistory([...cursorHistory, newCursor]);
      }

      setCurrentPageIndex(newPageIndex);
      setPagination({ cursor: newCursor, limit });
      lastRequestParamsRef.current = { filters: model, pagination: { cursor: newCursor, limit } };
      setRetryCount(0);
      onFiltersSubmitClick(model, { cursor: newCursor, limit });

    } else if (direction === 'previous') {
      // Going backward
      const newPageIndex = Math.max(0, currentPageIndex - 1);
      const previousCursor = cursorHistory[newPageIndex];

      setCurrentPageIndex(newPageIndex);
      setPagination({ cursor: previousCursor, limit });
      lastRequestParamsRef.current = { filters: model, pagination: { cursor: previousCursor, limit } };
      setRetryCount(0);
      onFiltersSubmitClick(model, { cursor: previousCursor, limit });

    } else if (direction === 'pageSize') {
      // Page size changed - reset to first page
      setCursorHistory([undefined]);
      setCurrentPageIndex(0);
      setPagination({ cursor: undefined, limit });
      lastRequestParamsRef.current = { filters: model, pagination: { cursor: undefined, limit } };
      setRetryCount(0);
      onFiltersSubmitClick(model, { cursor: undefined, limit });
    }
  };

  const handleManualRetry = useCallback(() => {
    if (lastRequestParamsRef.current) {
      setRetryCount(0);
      const { filters, pagination: retryPagination } = lastRequestParamsRef.current;
      onFiltersSubmitClick(filters, retryPagination);
    }
  }, [onFiltersSubmitClick]);

  const handleCancelDownload = useCallback(() => {
    setDownloadCancelled(true);
    downloadCancelledRef.current = true;
    setDownloadProgress({ current: 0, total: 0, stage: 'Cancelling download...' });

    // Reset states after a brief delay to show cancellation message
    setTimeout(() => {
      setIsDownloadingExcel(false);
      setDownloadCancelled(false);
      setDownloadError(null);
      setDownloadProgress({ current: 0, total: 0, stage: '' });
      downloadCancelledRef.current = false;
    }, 1500);
  }, []);

  const handleRetryDownload = useCallback(() => {
    setDownloadError(null);
    setDownloadCancelled(false);
    downloadCancelledRef.current = false;
    handleChunkedExcelDownload();
  }, []);

  const handleDisputePageChange = (direction: 'next' | 'previous' | 'pageSize', newLimit?: number) => {
    const limit = newLimit || disputePagination.limit;

    if (direction === 'next') {
      const newCursor = disputeTransactionsNextCursor;
      const newPageIndex = disputePageIndex + 1;
      if (newPageIndex === disputeCursorHistory.length) {
        setDisputeCursorHistory([...disputeCursorHistory, newCursor]);
      }
      setDisputePageIndex(newPageIndex);
      setDisputePagination({ cursor: newCursor, limit });
      onDisputeFiltersSubmitClick(disputeModel, { cursor: newCursor, limit });
    } else if (direction === 'previous') {
      const newPageIndex = Math.max(0, disputePageIndex - 1);
      const previousCursor = disputeCursorHistory[newPageIndex];
      setDisputePageIndex(newPageIndex);
      setDisputePagination({ cursor: previousCursor, limit });
      onDisputeFiltersSubmitClick(disputeModel, { cursor: previousCursor, limit });
    } else if (direction === 'pageSize') {
      setDisputeCursorHistory([undefined]);
      setDisputePageIndex(0);
      setDisputePagination({ cursor: undefined, limit });
      onDisputeFiltersSubmitClick(disputeModel, { cursor: undefined, limit });
    }
  };

  const handleDisputeChunkedDownload = useCallback(async () => {
    if (isDisputeDownloadingExcel || disputeTransactionsCount === 0) return;
    if (disputeTransactionsCount > MAX_DOWNLOAD_LIMIT) return;

    setIsDisputeDownloadingExcel(true);
    setDisputeDownloadProgress({ current: 0, total: 0, stage: 'Initializing...' });
    setDisputeDownloadError(null);
    setDisputeDownloadCancelled(false);
    disputeDownloadCancelledRef.current = false;

    try {
      const totalRecords = disputeTransactionsCount;
      const totalChunks = Math.ceil(totalRecords / RECORDS_PER_FILE);

      if (disputeDownloadCancelledRef.current) return;

      if (totalRecords <= RECORDS_PER_FILE) {
        setDisputeDownloadProgress({ current: 1, total: 1, stage: 'Fetching all records...' });
        try {
          const url = buildDisputeApiUrl(disputeModel, undefined, totalRecords, apiBaseUrl);
          const axiosResponse = await axios({ method: 'get', url, headers: { 'Content-Type': 'application/json' }, withCredentials: true, validateStatus: () => true });
          if (!disputeDownloadCancelledRef.current) {
            setDisputeDownloadProgress({ current: 1, total: 1, stage: 'Creating Excel file...' });
            const resData = axiosResponse.data;
            const resultTransfers = resData.transfers || resData;
            await downloadDisputeReportSingleFile(resultTransfers, disputeModel);
            setDisputeDownloadProgress({ current: 1, total: 1, stage: 'Download complete!' });
          }
        } catch (error) {
          await downloadDisputeReportSingleFile(disputeTransactions, disputeModel);
          setDisputeDownloadProgress({ current: 1, total: 1, stage: 'Download complete (current page)!' });
        }
        return;
      }

      // Large dataset: chunked download
      setDisputeDownloadProgress({ current: 0, total: totalChunks, stage: `Preparing chunked download (${totalRecords.toLocaleString()} records)...` });
      const allFiles: { filename: string; content: ArrayBuffer }[] = [];
      let currentCursor: string | undefined = undefined;
      let recordsFetched = 0;
      let chunkIndex = 0;

      while (recordsFetched < totalRecords && recordsFetched < MAX_DOWNLOAD_LIMIT) {
        if (disputeDownloadCancelledRef.current) return;

        const recordsToFetch = Math.min(RECORDS_PER_FILE, totalRecords - recordsFetched, MAX_DOWNLOAD_LIMIT - recordsFetched);
        if (!disputeDownloadCancelledRef.current) {
          setDisputeDownloadProgress({ current: chunkIndex, total: totalChunks, stage: `Fetching file ${chunkIndex + 1} of ${totalChunks}...` });
        }

        try {
          const url = buildDisputeApiUrl(disputeModel, currentCursor, recordsToFetch, apiBaseUrl);
          const axiosResponse = await axios({ method: 'get', url, headers: { 'Content-Type': 'application/json' }, withCredentials: true, validateStatus: () => true });
          if (disputeDownloadCancelledRef.current) return;

          const resData = axiosResponse.data;
          const chunkTransfers = resData.transfers || resData;
          if (!chunkTransfers || chunkTransfers.length === 0) throw new Error(`Chunk ${chunkIndex + 1} returned no data`);

          currentCursor = resData.nextCursor;
          recordsFetched += chunkTransfers.length;

          const excelFile = generateDisputeReportExcel(
            chunkTransfers,
            disputeModel,
            chunkIndex + 1,
            recordsFetched - chunkTransfers.length
          );
          allFiles.push(excelFile);
          chunkIndex++;
        } catch (chunkError) {
          throw new Error(`Download failed at file ${chunkIndex + 1}: ${chunkError.message}`);
        }

        if (!disputeDownloadCancelledRef.current) {
          setDisputeDownloadProgress({ current: chunkIndex, total: totalChunks, stage: `Completed file ${chunkIndex} of ${totalChunks}` });
        }

        if (currentCursor && recordsFetched < totalRecords && !disputeDownloadCancelledRef.current) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        if (!currentCursor && recordsFetched < totalRecords) break;
      }

      if (disputeDownloadCancelledRef.current) return;

      setDisputeDownloadProgress({ current: totalChunks, total: totalChunks, stage: `Creating ZIP file with ${allFiles.length} Excel files...` });
      await downloadZipFile(allFiles);

      if (!disputeDownloadCancelledRef.current) {
        setDisputeDownloadProgress({ current: totalChunks, total: totalChunks, stage: `Download complete! All ${totalChunks} files downloaded.` });
      }
    } catch (error) {
      if (!disputeDownloadCancelledRef.current) {
        setDisputeDownloadError(error.message);
        setDisputeDownloadProgress({ current: 0, total: 0, stage: `Download failed: ${error.message}` });
      }
    } finally {
      if (!disputeDownloadCancelledRef.current) {
        setTimeout(() => {
          if (!disputeDownloadError) {
            setIsDisputeDownloadingExcel(false);
            setDisputeDownloadProgress({ current: 0, total: 0, stage: '' });
          }
        }, 3000);
      }
    }
  }, [disputeModel, disputeTransactionsCount, isDisputeDownloadingExcel, RECORDS_PER_FILE, disputeTransactions, apiBaseUrl]);

  // Main chunked Excel download function
  const handleChunkedExcelDownload = useCallback(async () => {
    if (isDownloadingExcel || transfersCount === 0) return;

    // Safety check: don't download if over limit (button should already be disabled)
    if (transfersCount > MAX_DOWNLOAD_LIMIT) {
      return;
    }
    setIsDownloadingExcel(true);
    setDownloadProgress({ current: 0, total: 0, stage: 'Initializing...' });
    setDownloadError(null);
    setDownloadCancelled(false);
    downloadCancelledRef.current = false;

    try {
      const totalRecords = transfersCount;
      const totalChunks = Math.ceil(totalRecords / RECORDS_PER_FILE);

      // Check for cancellation
      if (downloadCancelledRef.current) {
        return;
      }

      // If total records <= RECORDS_PER_FILE, use single file download
      if (totalRecords <= RECORDS_PER_FILE) {
        setDownloadProgress({ current: 1, total: 1, stage: 'Fetching all records...' });
        try {
          const result = await fetchTransferChunk(
            model,
            undefined, // Start from beginning (no cursor)
            totalRecords,
            apiBaseUrl,
            2, // maxRetries
            (retryStage: string) => {
              if (!downloadCancelledRef.current) {
                setDownloadProgress({ current: 1, total: 1, stage: retryStage });
              }
            }
          );

          if (downloadCancelledRef.current) {
            return;
          }

          setDownloadProgress({ current: 1, total: 1, stage: 'Creating Excel file...' });
          await downloadTransfersToExcel(result.transfers, dateFormat);
          setDownloadProgress({ current: 1, total: 1, stage: 'Download complete!' });
        } catch (error) {
          console.log('Direct fetch failed, using current page data');
          await downloadTransfersToExcel(transfers, dateFormat);
          setDownloadProgress({ current: 1, total: 1, stage: 'Download complete (current page)!' });
        }
        return;
      }

      // For large datasets, implement cursor-based sequential chunked download
      if (totalRecords > RECORDS_PER_FILE) {
        setDownloadProgress({
          current: 0,
          total: totalChunks,
          stage: `Large dataset detected (${totalRecords.toLocaleString()} records). Preparing chunked download...`
        });

        const allFiles: { filename: string; content: ArrayBuffer }[] = [];
        let currentCursor: string | undefined = undefined;
        let recordsFetched = 0;
        let chunkIndex = 0;

        // Fetch and process each chunk sequentially using cursor pagination - ALL must succeed
        while (recordsFetched < totalRecords && recordsFetched < MAX_DOWNLOAD_LIMIT) {
          // Check for cancellation before each chunk
          if (downloadCancelledRef.current) {
            return;
          }

          const recordsToFetch = Math.min(RECORDS_PER_FILE, totalRecords - recordsFetched, MAX_DOWNLOAD_LIMIT - recordsFetched);

          if (!downloadCancelledRef.current) {
            setDownloadProgress({
              current: chunkIndex,
              total: totalChunks,
              stage: `Fetching file ${chunkIndex + 1} of ${totalChunks} (${recordsToFetch} records)...`
            });
          }

          try {
            // Fetch data for this chunk using cursor with progress callback for retry information
            const result: any = await fetchTransferChunk(
              model,
              currentCursor, // Use cursor from previous iteration
              recordsToFetch,
              apiBaseUrl,
              2, // maxRetries
              (retryStage: string) => {
                if (!downloadCancelledRef.current) {
                  setDownloadProgress({
                    current: chunkIndex,
                    total: totalChunks,
                    stage: retryStage
                  });
                }
              }
            );

            // Check for cancellation after fetch
            if (downloadCancelledRef.current) {
              return;
            }

            if (!result.transfers || result.transfers.length === 0) {
              throw new Error(`Chunk ${chunkIndex + 1} returned no data`);
            }

            // Update cursor for next iteration
            currentCursor = result.nextCursor;
            recordsFetched += result.transfers.length;

            // Generate Excel file for this chunk
            const excelFile = generateExcelFileForChunk(result.transfers, chunkIndex + 1, dateFormat);
            allFiles.push(excelFile);
            chunkIndex++;

          } catch (chunkError) {
            console.error(`Failed to process chunk ${chunkIndex + 1}:`, chunkError);
            // ALL-OR-NOTHING: If any chunk fails, entire download fails
            throw new Error(`Download failed at file ${chunkIndex + 1} of ${totalChunks}: ${chunkError.message}`);
          }

          // Update progress after successful chunk
          if (!downloadCancelledRef.current) {
            setDownloadProgress({
              current: chunkIndex,
              total: totalChunks,
              stage: `Completed file ${chunkIndex} of ${totalChunks} (${recordsFetched} records fetched)`
            });
          }

          // Small delay to prevent API spike
          if (currentCursor && recordsFetched < totalRecords && !downloadCancelledRef.current) {
            await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay between chunks
          }

          // Safety check: if no more cursor and we haven't fetched all records, something is wrong
          if (!currentCursor && recordsFetched < totalRecords) {
            console.warn(`No more data available after ${recordsFetched} records (expected ${totalRecords})`);
            break;
          }
        }

        // Check for cancellation before creating ZIP
        if (downloadCancelledRef.current) {
          return;
        }

        // All chunks successful - create and download ZIP file
        setDownloadProgress({
          current: totalChunks,
          total: totalChunks,
          stage: `Creating ZIP file with ${allFiles.length} Excel files...`
        });

        await downloadZipFile(allFiles);

        if (!downloadCancelledRef.current) {
          setDownloadProgress({
            current: totalChunks,
            total: totalChunks,
            stage: `Download complete! All ${totalChunks} files successfully downloaded.`
          });
        }
      }

    } catch (error) {
      console.error('Chunked Excel download failed:', error);

      if (!downloadCancelledRef.current) {
        setDownloadError(error.message);
        setDownloadProgress({ current: 0, total: 0, stage: `Download failed: ${error.message}` });
      }
    } finally {
      // Reset download state after a delay (only if not cancelled - cancellation handles its own reset)
      if (!downloadCancelledRef.current) {
        setTimeout(() => {
          if (!downloadError) {
            setIsDownloadingExcel(false);
            setDownloadProgress({ current: 0, total: 0, stage: '' });
          }
        }, 3000);
      }
    }
  }, [model, transfersCount, isDownloadingExcel, RECORDS_PER_FILE, transfers, dateFormat]);

  let content = null;
  let onSubmit;
  let submitLabel;

  const transfersColumns = [
    {
      label: 'Transfer ID',
      key: 'id',
      sortable: true,
      func: (value: string, item: Transfer) => (
        <Link>
          <span style={{ textDecoration: 'underline' }}>{item.id}</span>
        </Link>
      ),
    },
    {
      label: 'Amount',
      key: 'amount',
      sortable: true,
      func: (value: string, item: Transfer) => `${item.currency} ${item.amount}`,
    },
    {
      label: 'Direction',
      key: 'direction',
      sortable: true,
      func: helpers.toSpacedPascalCase,
    },
    {
      label: 'Status',
      key: 'status',
      sortable: true,
      func: helpers.toSpacedPascalCase,
    },
    {
      label: 'Batch ID',
      key: 'batchId',
      sortable: true,
    },
    {
      label: 'Institution',
      key: 'institution',
      sortable: true,
    },
    {
      label: 'Date',
      key: 'initiatedTimestamp',
      sortable: true,
      func: (value: string) => helpers.toTransfersDate(value, dateFormat),
    },
  ];

  if (!isTransfersRequested && !isDisputeRequested) {
    content = (
      <TransferFilters
        model={model}
        onFilterChange={onFilterChange}
        dateRangeError={dateRangeError}
        disputeModel={disputeModel}
        onDisputeFilterChange={onDisputeFilterChange}
        disputeDateRangeError={disputeDateRangeError}
        onTabChange={setActiveFilterTab}
      />
    );

    if (activeFilterTab === 2) {
      // Dispute tab submit
      onSubmit = () => {
        if (!disputeModel.from && !disputeModel.to) {
          setDisputeDateRangeError('Please select a date range or use a preset filter');
          return;
        }
        const fromTime = disputeModel.from ? new Date(disputeModel.from as number).getTime() : null;
        const toTime = disputeModel.to ? new Date(disputeModel.to as number).getTime() : Date.now();
        if (fromTime && toTime) {
          const rangeDays = (toTime - fromTime) / (24 * 60 * 60 * 1000);
          if (rangeDays > MAX_DATE_RANGE_DAYS) {
            setDisputeDateRangeError(`Date range cannot exceed ${MAX_DATE_RANGE_DAYS} days (${Math.ceil(rangeDays)} days selected). Please narrow your search.`);
            return;
          }
        }
        setDisputeDateRangeError(null);
        setActiveMode('dispute');
        const initialPagination = { cursor: undefined, limit: 50 };
        setDisputePagination(initialPagination);
        setDisputeCursorHistory([undefined]);
        setDisputePageIndex(0);
        onDisputeFiltersSubmitClick(disputeModel, initialPagination);
      };
      submitLabel = 'Generate Report';
    } else {
      // Basic or Advanced tab submit
      onSubmit = () => {
        if (!model.transferId) {
          if (!model.from && !model.to) {
            setDateRangeError('Please select a date range or use a preset filter');
            return;
          }

          const fromTime = model.from ? new Date(model.from as number).getTime() : null;
          const toTime = model.to ? new Date(model.to as number).getTime() : Date.now();

          if (fromTime && toTime) {
            const rangeDays = (toTime - fromTime) / (24 * 60 * 60 * 1000);
            if (rangeDays > MAX_DATE_RANGE_DAYS) {
              setDateRangeError(`Date range cannot exceed ${MAX_DATE_RANGE_DAYS} days (${Math.ceil(rangeDays)} days selected). Please narrow your search.`);
              return;
            }
          }
        }

        setDateRangeError(null);
        setActiveMode('transfers');
        const initialPagination = { cursor: undefined, limit: 50 };
        setPagination(initialPagination);
        setCursorHistory([undefined]);
        setCurrentPageIndex(0);
        lastRequestParamsRef.current = { filters: model, pagination: initialPagination };
        setRetryCount(0);
        onFiltersSubmitClick(model, initialPagination);
      };
      submitLabel = 'Find Transfers';
    }
  } else if (isDisputeRequested && (disputeTransactionsError || isDisputeTransactionsPending) && activeMode === 'dispute') {
    // Dispute loading/error state
    const renderDisputeStatusDisplay = () => {
      if (isDisputeTransactionsPending && !disputeTransactionsError) {
        return (
          <div style={{ background: '#f8f9fa', border: '1px solid #e9ecef', borderRadius: '8px', padding: '20px', margin: '16px 0', textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <Spinner size={16} />
              <span style={{ fontSize: '14px', color: '#495057' }}>Loading dispute transactions...</span>
            </div>
          </div>
        );
      }
      if (disputeTransactionsError) {
        return (
          <div style={{ background: '#f8d7da', border: '1px solid #f5c6cb', borderRadius: '8px', padding: '16px', margin: '16px 0', textAlign: 'center' }}>
            <div style={{ fontSize: '14px', fontWeight: 500, color: '#721c24', marginBottom: '8px' }}>Unable to load dispute transactions</div>
            <div style={{ fontSize: '12px', color: '#721c24' }}>{disputeTransactionsError}</div>
          </div>
        );
      }
      return null;
    };
    content = renderDisputeStatusDisplay();
    onSubmit = () => {
      setActiveMode(null);
      onDisputeTransactionsSubmitClick();
    };
    submitLabel = 'Back to filtering';
  } else if (isTransfersRequested && (transfersError || isTransfersPending) && activeMode === 'transfers') {
    // Unified Status Display Component
    const renderStatusDisplay = () => {
      // Download progress takes priority
      if (isDownloadingExcel && downloadProgress.stage) {
        return (
          <div style={{
            background: '#f8f9fa',
            border: '1px solid #e9ecef',
            borderRadius: '8px',
            padding: '16px',
            margin: '16px 0',
            textAlign: 'center'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '12px' }}>
              <Spinner size={16} />
              <span style={{ fontSize: '14px', fontWeight: 500, color: '#495057' }}>
                {downloadProgress.stage}
              </span>
            </div>
            {downloadProgress.total > 0 && (
              <div>
                <div style={{
                  width: '100%',
                  maxWidth: '400px',
                  height: '6px',
                  backgroundColor: '#e9ecef',
                  borderRadius: '3px',
                  margin: '0 auto 8px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${(downloadProgress.current / downloadProgress.total) * 100}%`,
                    height: '100%',
                    backgroundColor: '#007bff',
                    borderRadius: '3px',
                    transition: 'width 0.3s ease'
                  }} />
                </div>
                <span style={{ fontSize: '12px', color: '#6c757d' }}>
                  {downloadProgress.current} of {downloadProgress.total} files completed
                </span>
              </div>
            )}
          </div>
        );
      }

      // Transfer loading state
      if (isTransfersPending && !transfersError) {
        return (
          <div style={{
            background: '#f8f9fa',
            border: '1px solid #e9ecef',
            borderRadius: '8px',
            padding: '20px',
            margin: '16px 0',
            textAlign: 'center'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <Spinner size={16} />
              <span style={{ fontSize: '14px', color: '#495057' }}>Loading transfers...</span>
            </div>
          </div>
        );
      }

      // Error state with retry information
      if (transfersError) {
        const isRetryableError = transfersError?.includes('401') || transfersError?.includes('502') || transfersError?.includes('503') || transfersError?.includes('504');
        return (
          <div style={{
            background: retryCount >= maxRetries ? '#f8d7da' : '#fff3cd',
            border: `1px solid ${retryCount >= maxRetries ? '#f5c6cb' : '#ffeaa7'}`,
            borderRadius: '8px',
            padding: '16px',
            margin: '16px 0',
            textAlign: 'center'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '18px' }}>{retryCount >= maxRetries ? '❌' : '⚠️'}</span>
              <span style={{ fontSize: '14px', fontWeight: 500, color: retryCount >= maxRetries ? '#721c24' : '#856404' }}>
                Unable to load transfers
              </span>
            </div>
            <div style={{ fontSize: '12px', color: retryCount >= maxRetries ? '#721c24' : '#856404', marginBottom: '12px' }}>
              {transfersError}
              {isRetryableError && isRetrying && (
                <span> (retrying... {retryCount}/{maxRetries})</span>
              )}
            </div>
            {isRetryableError && retryCount >= maxRetries && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                <Button
                  label="Retry"
                  onClick={handleManualRetry}
                  style={{ fontSize: '12px', padding: '6px 12px' }}
                />
                <Button
                  label="Close"
                  onClick={onModalCloseClick}
                  style={{ fontSize: '12px', padding: '6px 12px' }}
                  noFill
                />
              </div>
            )}
          </div>
        );
      }

      return null;
    };

    content = renderStatusDisplay();
  } else if (isDisputeRequested && activeMode === 'dispute') {
    // Dispute results
    content = (
      <div className="transfers__transfers__list">
        {isDisputeRequested && !isDisputeTransactionsCountPending && (
          <div style={{ padding: '12px 16px', backgroundColor: '#f8f9fa', border: '1px solid #dee2e6', borderRadius: '4px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '14px', fontWeight: 500, color: '#212529' }}>
              {disputeTransactionsCount === 0 ? (
                <span style={{ color: '#6c757d' }}>No dispute records found</span>
              ) : (
                <>
                  <span style={{ color: '#495057' }}>Dispute Report Results: </span>
                  <span style={{ color: '#007bff', fontSize: '16px' }}>{disputeTransactionsCount.toLocaleString()}</span>
                  <span style={{ color: '#6c757d', fontSize: '13px' }}> {disputeTransactionsCount === 1 ? 'record' : 'records'}</span>
                </>
              )}
            </div>
          </div>
        )}

        {disputeTransactions.length > 0 && (
          <>
            <CursorPagination
              currentCursor={disputePagination.cursor}
              nextCursor={disputeTransactionsNextCursor}
              hasMore={disputeTransactionsHasMore}
              recordsShown={disputeTransactions.length}
              pageSize={disputePagination.limit}
              onPrevious={() => handleDisputePageChange('previous')}
              onNext={() => handleDisputePageChange('next')}
              onPageSizeChange={(size) => handleDisputePageChange('pageSize', size)}
              isLoading={isDisputeTransactionsPending}
            />

            <div style={{ marginTop: '16px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  {disputeTransactionsCount > 50 && (
                    <Button
                      label={
                        isDisputeDownloadingExcel
                          ? 'Preparing Download...'
                          : disputeTransactionsCount > MAX_DOWNLOAD_LIMIT
                            ? `Too Many Results (${disputeTransactionsCount.toLocaleString()} records) - Refine Search`
                            : `Download (${disputeTransactionsCount.toLocaleString()} records)`
                      }
                      noFill
                      onClick={handleDisputeChunkedDownload}
                      disabled={isDisputeDownloadingExcel || isDisputeTransactionsPending || disputeTransactionsCount > MAX_DOWNLOAD_LIMIT}
                    />
                  )}
                  <Button
                    label={disputeTransactionsCount <= 50 ? 'Download Results' : 'Download Current Page'}
                    onClick={() => downloadDisputeReportSingleFile(disputeTransactions, disputeModel)}
                    disabled={isDisputeDownloadingExcel || isDisputeTransactionsPending}
                    style={{ fontSize: '12px', padding: '6px 12px' }}
                    noFill
                  />
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: '#6c757d' }}>Date Format:</span>
                  <Button
                    label={dateFormat === 'iso' ? 'ISO (2025-12-21T08:22:47+07:00)' : 'Readable (21/12/2025 08:22:47)'}
                    onClick={() => setDateFormat(dateFormat === 'iso' ? 'readable' : 'iso')}
                    style={{ fontSize: '11px', padding: '4px 8px' }}
                    noFill
                  />
                </div>
              </div>
              {(isDisputeDownloadingExcel || disputeDownloadError) && disputeDownloadProgress.stage && (
                <div style={{ background: disputeDownloadError ? '#f8d7da' : '#f8f9fa', border: `1px solid ${disputeDownloadError ? '#f5c6cb' : '#e9ecef'}`, borderRadius: '8px', padding: '16px', marginTop: '12px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '12px' }}>
                    {disputeDownloadError ? <span style={{ fontSize: '18px' }}>❌</span> : <Spinner size={16} />}
                    <span style={{ fontSize: '14px', fontWeight: 500, color: disputeDownloadError ? '#721c24' : '#495057' }}>{disputeDownloadProgress.stage}</span>
                  </div>
                  {disputeDownloadError && (
                    <Button label="Retry Download" onClick={() => { setDisputeDownloadError(null); handleDisputeChunkedDownload(); }} style={{ fontSize: '12px', padding: '6px 12px', marginTop: '8px' }} />
                  )}
                </div>
              )}
            </div>

            <PaginatedTable
              columns={transfersColumns}
              data={disputeTransactions}
              pagination={{ limit: disputePagination.limit }}
              totalCount={disputeTransactionsCount}
              isLoading={isDisputeTransactionsPending || isDisputeDownloadingExcel}
              isLoadingCount={isDisputeTransactionsCountPending}
              onRowClick={onTransferRowClick}
              onPageChange={() => { }}
              showRowNumbers={false}
              hidePagination={true}
            />

            <div style={{ marginTop: '16px' }}>
              <CursorPagination
                currentCursor={disputePagination.cursor}
                nextCursor={disputeTransactionsNextCursor}
                hasMore={disputeTransactionsHasMore}
                recordsShown={disputeTransactions.length}
                pageSize={disputePagination.limit}
                onPrevious={() => handleDisputePageChange('previous')}
                onNext={() => handleDisputePageChange('next')}
                onPageSizeChange={(size) => handleDisputePageChange('pageSize', size)}
                isLoading={isDisputeTransactionsPending}
              />
            </div>
          </>
        )}
      </div>
    );
    onSubmit = () => {
      setActiveMode(null);
      onDisputeTransactionsSubmitClick();
    };
    submitLabel = 'Back to filtering';
  } else {
    content = (
      <div className="transfers__transfers__list">
        {/* Search Results Count */}
        {isTransfersRequested && !isTransfersCountPending && (
          <div style={{
            padding: '12px 16px',
            backgroundColor: '#f8f9fa',
            border: '1px solid #dee2e6',
            borderRadius: '4px',
            marginBottom: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{ fontSize: '14px', fontWeight: 500, color: '#212529' }}>
              {transfersCount === 0 ? (
                <span style={{ color: '#6c757d' }}>No records found</span>
              ) : (
                <>
                  <span style={{ color: '#495057' }}>Search Results: </span>
                  <span style={{ color: '#007bff', fontSize: '16px' }}>{transfersCount.toLocaleString()}</span>
                  <span style={{ color: '#6c757d', fontSize: '13px' }}> {transfersCount === 1 ? 'record' : 'records'}</span>
                </>
              )}
            </div>
          </div>
        )}

        {transfers.length > 0 && (
          <>
            {/* Cursor Pagination - Top */}
            <CursorPagination
              currentCursor={pagination.cursor}
              nextCursor={transfersNextCursor}
              hasMore={transfersHasMore}
              recordsShown={transfers.length}
              pageSize={pagination.limit}
              onPrevious={() => handlePageChange('previous')}
              onNext={() => handlePageChange('next')}
              onPageSizeChange={(size) => handlePageChange('pageSize', size)}
              isLoading={isTransfersPending}
            />

            <div style={{ marginTop: '16px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  {transfersCount > 50 && (
                    <Button
                      label={
                        isDownloadingExcel
                          ? 'Preparing Download...'
                          : transfersCount > MAX_DOWNLOAD_LIMIT
                            ? `Too Many Results (${transfersCount.toLocaleString()} records) - Refine Search`
                            : `Download (${transfersCount.toLocaleString()} records)`
                      }
                      noFill
                      onClick={handleChunkedExcelDownload}
                      disabled={isDownloadingExcel || isTransfersPending || transfersCount > MAX_DOWNLOAD_LIMIT}
                    />
                  )}
                  <Button
                    label={transfersCount <= 50 ? "Download Results" : "Download Current Page"}
                    onClick={() => downloadTransfersToExcel(transfers, dateFormat)}
                    disabled={isDownloadingExcel || isTransfersPending}
                    style={{ fontSize: '12px', padding: '6px 12px' }}
                    noFill
                  />
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: '#6c757d' }}>Date Format:</span>
                    <Button
                      label={dateFormat === 'iso' ? 'ISO (2025-12-21T08:22:47+07:00)' : 'Readable (21/12/2025 08:22:47)'}
                      onClick={() => setDateFormat(dateFormat === 'iso' ? 'readable' : 'iso')}
                      style={{ fontSize: '11px', padding: '4px 8px' }}
                      noFill
                    />
                  </div>
                  {transfersCount > 50 && (
                    <span style={{
                      fontSize: '11px',
                      color: transfersCount > MAX_DOWNLOAD_LIMIT ? '#d9534f' : '#5bc0de',
                      padding: '4px 8px',
                      backgroundColor: transfersCount > MAX_DOWNLOAD_LIMIT ? '#f2dede' : '#d9edf7',
                      borderRadius: '3px',
                      border: `1px solid ${transfersCount > MAX_DOWNLOAD_LIMIT ? '#d9534f' : '#5bc0de'}`
                    }}>
                      {transfersCount > MAX_DOWNLOAD_LIMIT
                        ? `⚠ Max download: ${MAX_DOWNLOAD_LIMIT.toLocaleString()} records`
                        : `ℹ Max download: ${MAX_DOWNLOAD_LIMIT.toLocaleString()} records`
                      }
                    </span>
                  )}
                </div>
              </div>
              {/* Download progress display */}
              {(isDownloadingExcel || downloadError) && downloadProgress.stage && (
                <div style={{
                  background: downloadError ? '#f8d7da' : '#f8f9fa',
                  border: `1px solid ${downloadError ? '#f5c6cb' : '#e9ecef'}`,
                  borderRadius: '8px',
                  padding: '16px',
                  marginTop: '12px',
                  textAlign: 'center'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '12px' }}>
                    {downloadError ? (
                      <span style={{ fontSize: '18px' }}>❌</span>
                    ) : (
                      <Spinner size={16} />
                    )}
                    <span style={{
                      fontSize: '14px',
                      fontWeight: 500,
                      color: downloadError ? '#721c24' : '#495057'
                    }}>
                      {downloadProgress.stage}
                    </span>
                  </div>
                  {downloadProgress.total > 0 && !downloadError && (
                    <div>
                      <div style={{
                        width: '100%',
                        maxWidth: '400px',
                        height: '6px',
                        backgroundColor: '#e9ecef',
                        borderRadius: '3px',
                        margin: '0 auto 8px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          width: `${(downloadProgress.current / downloadProgress.total) * 100}%`,
                          height: '100%',
                          backgroundColor: '#007bff',
                          borderRadius: '3px',
                          transition: 'width 0.3s ease'
                        }} />
                      </div>
                      <span style={{ fontSize: '12px', color: '#6c757d' }}>
                        {downloadProgress.current} of {downloadProgress.total} files completed
                      </span>
                    </div>
                  )}
                  {/* Action buttons */}
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '12px' }}>
                    {downloadError ? (
                      <>
                        <Button
                          label="Retry Download"
                          onClick={handleRetryDownload}
                          style={{ fontSize: '12px', padding: '6px 12px' }}
                        />
                        <Button
                          label="Cancel"
                          onClick={() => {
                            setDownloadError(null);
                            setDownloadProgress({ current: 0, total: 0, stage: '' });
                            setIsDownloadingExcel(false);
                          }}
                          style={{ fontSize: '12px', padding: '6px 12px' }}
                          noFill
                        />
                      </>
                    ) : isDownloadingExcel && !downloadCancelled && (
                      <Button
                        label="Cancel Download"
                        onClick={handleCancelDownload}
                        style={{ fontSize: '12px', padding: '6px 12px' }}
                        noFill
                      />
                    )}
                  </div>
                </div>
              )}
            </div>

            <PaginatedTable
              columns={transfersColumns}
              data={transfers}
              pagination={{ limit: pagination.limit }}
              totalCount={transfersCount}
              isLoading={isTransfersPending || isDownloadingExcel}
              isLoadingCount={isTransfersCountPending}
              onRowClick={onTransferRowClick}
              onPageChange={() => { }}
              showRowNumbers={false}
              hidePagination={true}
            />

            {/* Cursor Pagination - Bottom */}
            <div style={{ marginTop: '16px' }}>
              <CursorPagination
                currentCursor={pagination.cursor}
                nextCursor={transfersNextCursor}
                hasMore={transfersHasMore}
                recordsShown={transfers.length}
                pageSize={pagination.limit}
                onPrevious={() => handlePageChange('previous')}
                onNext={() => handlePageChange('next')}
                onPageSizeChange={(size) => handlePageChange('pageSize', size)}
                isLoading={isTransfersPending}
              />
            </div>
          </>
        )}
      </div>
    );
    onSubmit = () => {
      setActiveMode(null);
      onTransfersSubmitClick();
    };
    submitLabel = 'Back to filtering';
  }

  return (
    <Modal
      title="Find a Transfer"
      width="1200px"
      onClose={onModalCloseClick}
      onSubmit={onSubmit}
      allowSubmit
      isSubmitEnabled={onSubmit !== undefined}
      primaryAction={submitLabel}
    >
      {content}
    </Modal>
  );
};

const dateRanges = [
  { label: 'Custom', value: 'CUSTOM' },
  { label: helpers.toSpacedPascalCase(DateRange.Today), value: DateRange.Today },
  { label: helpers.toSpacedPascalCase(DateRange.Past48Hours), value: DateRange.Past48Hours },
  { label: helpers.toSpacedPascalCase(DateRange.OneWeek), value: DateRange.OneWeek },
  { label: helpers.toSpacedPascalCase(DateRange.OneMonth), value: DateRange.OneMonth },
];

const transferStatuses = [
  { label: helpers.toSpacedPascalCase(TransferStatus.Success), value: TransferStatus.Success },
  { label: helpers.toSpacedPascalCase(TransferStatus.Pending), value: TransferStatus.Pending },
  { label: helpers.toSpacedPascalCase(TransferStatus.Error), value: TransferStatus.Error },
];

const aliasType = [
  { label: 'All', value: null },
  { label: helpers.toSpacedPascalCase(AliasType.MSISDN), value: AliasType.MSISDN },
  { label: helpers.toSpacedPascalCase(AliasType.Account), value: AliasType.Account },
  { label: helpers.toSpacedPascalCase(AliasType.Email), value: AliasType.Email },
  { label: helpers.toSpacedPascalCase(AliasType.Personal), value: AliasType.Personal },
  { label: helpers.toSpacedPascalCase(AliasType.Business), value: AliasType.Business },
  { label: helpers.toSpacedPascalCase(AliasType.Device), value: AliasType.Device },
  { label: helpers.toSpacedPascalCase(AliasType.IBAN), value: AliasType.IBAN },
  { label: helpers.toSpacedPascalCase(AliasType.Alias), value: AliasType.Alias },
];

const transferDirectionOfFunds = [
  {
    label: helpers.toSpacedPascalCase(TransferDirection.Inbound),
    value: TransferDirection.Inbound,
  },
  {
    label: helpers.toSpacedPascalCase(TransferDirection.Outbound),
    value: TransferDirection.Outbound,
  },
  {
    label: helpers.toSpacedPascalCase(TransferDirection.All),
    value: TransferDirection.All,
  },
];

const disputeDirectionOfFunds = [
  {
    label: helpers.toSpacedPascalCase(TransferDirection.Inbound),
    value: TransferDirection.Inbound,
  },
];

interface TransferFiltersProps {
  model: TransferFilter;
  onFilterChange: ({ field, value }: { field: string; value: FilterChangeValue }) => void;
  dateRangeError: string | null;
  disputeModel: DisputeFilter;
  onDisputeFilterChange: ({ field, value }: { field: string; value: FilterChangeValue }) => void;
  disputeDateRangeError: string | null;
  onTabChange?: (index: number) => void;
}

const disputeCurrencyOptions = [
  { label: 'All', value: 'ALL' },
  { label: 'USD', value: 'USD' },
  { label: 'LRD', value: 'LRD' },
];

const toDatetimeLocal = (unixMs: FilterChangeValue): string => {
  if (!unixMs) return '';
  const d = new Date(Number(unixMs));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const nativeDateInputStyle: React.CSSProperties = {
  height: '38px',
  borderTop: '1px solid #e5e5e5',
  borderLeft: '1px solid #e5e5e5',
  borderRight: '1px solid #e5e5e5',
  borderBottom: '2px solid #4fc7e7',
  padding: '0 8px 0 13px',
  fontSize: '13px',
  fontFamily: 'inherit',
  background: '#fcfcfc',
  color: '#333',
  width: '230px',
  boxSizing: 'border-box',
  cursor: 'pointer',
  outline: 'none',
};

const TransferFilters: FC<TransferFiltersProps> = ({ model, onFilterChange, dateRangeError, disputeModel, onDisputeFilterChange, disputeDateRangeError, onTabChange }) => {
  const handleTabClick = (index: number) => {
    if (onTabChange) onTabChange(index);
  };

  return (
    <Tabs onSelect={(_e: any, index: number) => handleTabClick(index)}>
      <TabList>
        <Tab>Basic Find a Transfer</Tab>
        <Tab>Advanced Filtering</Tab>
        <Tab>Dispute Transactions</Tab>
      </TabList>
      <TabPanels>
        <TabPanel>
          <DataLabel size="l">Find an exact transfer by entering the ID:</DataLabel>
          <br />
          <br />
          <FormInput
            id="find-transfer-modal__transfer-id"
            label="Transfer ID"
            type="text"
            value={model.transferId || ''}
            onChange={(value: FilterChangeValue) => onFilterChange({ field: 'transferId', value })}
          />
        </TabPanel>
        <TabPanel>
          <DataLabel size="l">Filter transfers:</DataLabel>
          <br />
          {dateRangeError && (
            <div style={{
              marginBottom: '16px',
              padding: '12px 16px',
              backgroundColor: '#f8d7da',
              border: '1px solid #f5c6cb',
              borderRadius: '4px',
              color: '#721c24',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span style={{ fontSize: '16px' }}>⚠️</span>
              <span>{dateRangeError}</span>
            </div>
          )}
          {model.dates === 'CUSTOM' && !dateRangeError && (model.from || model.to) && (
            <div style={{
              marginBottom: '16px',
              padding: '10px 14px',
              backgroundColor: '#fff3cd',
              border: '1px solid #ffc107',
              borderRadius: '4px',
              color: '#856404',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span style={{ fontSize: '14px' }}>ℹ️</span>
              <span>Custom date ranges are limited to 1 month maximum.</span>
            </div>
          )}
          <div style={{ marginBottom: '24px' }}>
            <DataLabel size="m">Approximate time of transfer</DataLabel>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', marginTop: '8px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '12px', color: '#6c757d', fontWeight: 500 }}>Date</span>
                <Select
                  id="find-transfer-modal__date"
                  type="select"
                  style={{ width: '200px' }}
                  options={dateRanges}
                  selected={model.dates || ''}
                  onChange={(value: FilterChangeValue) => onFilterChange({ field: 'dates', value })}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '12px', color: '#6c757d', fontWeight: 500 }}>From</span>
                <input
                  id="find-transfer-modal__from-date"
                  type="datetime-local"
                  style={{ ...nativeDateInputStyle, width: '250px' }}
                  value={toDatetimeLocal(model.from || '')}
                  onChange={(e) => {
                    const val = e.target.value ? new Date(e.target.value).getTime() : '';
                    onFilterChange({ field: 'from', value: val });
                  }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '12px', color: '#6c757d', fontWeight: 500 }}>To</span>
                <input
                  id="find-transfer-modal__to-date"
                  type="datetime-local"
                  style={{ ...nativeDateInputStyle, width: '250px' }}
                  value={toDatetimeLocal(model.to || '')}
                  onChange={(e) => {
                    const val = e.target.value ? new Date(e.target.value).getTime() : '';
                    onFilterChange({ field: 'to', value: val });
                  }}
                />
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
            <div style={{ minWidth: '220px' }}>
              <FormInput
                id="find-transfer-modal__directionOfFunds"
                label="Direction of Funds"
                style={{ width: '220px' }}
                type="select"
                options={transferDirectionOfFunds}
                value={model.direction || TransferDirection.All}
                onChange={(value: FilterChangeValue) => onFilterChange({ field: 'direction', value })}
              />
            </div>
            <div style={{ minWidth: '200px' }}>
              <FormInput
                id="find-transfer-modal__aliasType"
                label="Payee Alias Type"
                type="select"
                style={{ width: '200px' }}
                options={aliasType}
                value={model.aliasType || null}
                onChange={(value: FilterChangeValue) => onFilterChange({ field: 'aliasType', value })}
              />
            </div>
            <div style={{ minWidth: '250px' }}>
              <FormInput
                id="find-transfer-modal__payeeAlias"
                label="Payee Alias"
                type="text"
                style={{ width: '250px' }}
                value={model.payeeAlias || ''}
                onChange={(value: FilterChangeValue) => {
                  onFilterChange({ field: 'payeeAlias', value });
                }}
              />
            </div>
            <div style={{ minWidth: '250px' }}>
              <FormInput
                id="find-transfer-modal__aliasSubValue"
                label="Payee Alias Sub Value"
                type="text"
                style={{ width: '250px' }}
                value={model.aliasSubValue || ''}
                onChange={(value: FilterChangeValue) => {
                  onFilterChange({ field: 'aliasSubValue', value });
                }}
              />
            </div>
          </div>
          <br />
          <FormInput
            id="find-transfer-modal__institution"
            label="Contains Institution"
            type="text"
            value={model.institution || ''}
            onChange={(value: FilterChangeValue) => onFilterChange({ field: 'institution', value })}
          />
          <FormInput
            id="find-transfer-modal__transfer-status"
            label="Transfer Status"
            type="select"
            options={transferStatuses}
            value={model.status || ''}
            onChange={(value: FilterChangeValue) => onFilterChange({ field: 'status', value })}
          />
        </TabPanel>
        <TabPanel>
          <div style={{ padding: '8px 0 16px' }}>
            <DataLabel size="l">Find Disputed Transfers</DataLabel>
          </div>

          {disputeDateRangeError && (
            <div style={{
              marginBottom: '20px',
              padding: '12px 16px',
              backgroundColor: '#f8d7da',
              border: '1px solid #f5c6cb',
              borderRadius: '4px',
              color: '#721c24',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              <span style={{ fontSize: '16px' }}>⚠️</span>
              <span>{disputeDateRangeError}</span>
            </div>
          )}

          {/* Date Range Row */}
          <div style={{ marginBottom: '24px' }}>
            <DataLabel size="m">Time Range</DataLabel>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', marginTop: '8px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '12px', color: '#6c757d', fontWeight: 500 }}>Date</span>
                <Select
                  id="dispute-modal__date"
                  type="select"
                  style={{ width: '180px' }}
                  options={dateRanges}
                  selected={disputeModel.dates || ''}
                  onChange={(value: FilterChangeValue) => onDisputeFilterChange({ field: 'dates', value })}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '12px', color: '#6c757d', fontWeight: 500 }}>From</span>
                <input
                  id="dispute-modal__from"
                  type="datetime-local"
                  style={nativeDateInputStyle}
                  value={toDatetimeLocal(disputeModel.from || '')}
                  onChange={(e) => {
                    const val = e.target.value ? new Date(e.target.value).getTime() : '';
                    onDisputeFilterChange({ field: 'from', value: val });
                  }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '12px', color: '#6c757d', fontWeight: 500 }}>To</span>
                <input
                  id="dispute-modal__to"
                  type="datetime-local"
                  style={nativeDateInputStyle}
                  value={toDatetimeLocal(disputeModel.to || '')}
                  onChange={(e) => {
                    const val = e.target.value ? new Date(e.target.value).getTime() : '';
                    onDisputeFilterChange({ field: 'to', value: val });
                  }}
                />
              </div>
            </div>
            {disputeModel.dates === 'CUSTOM' && !disputeDateRangeError && (disputeModel.from || disputeModel.to) && (
              <div style={{ marginTop: '8px', fontSize: '12px', color: '#856404', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>ℹ️</span>
                <span>Custom date ranges are limited to 1 month maximum.</span>
              </div>
            )}
          </div>

          {/* Filters Row */}
          <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
            <div style={{ minWidth: '220px' }}>
              <FormInput
                id="dispute-modal__direction"
                label="Direction of Funds"
                type="select"
                options={disputeDirectionOfFunds}
                value={disputeModel.direction || TransferDirection.Inbound}
                onChange={(value: FilterChangeValue) => onDisputeFilterChange({ field: 'direction', value })}
              />
            </div>
            <div style={{ minWidth: '180px' }}>
              <FormInput
                id="dispute-modal__currency"
                label="Currency"
                type="select"
                options={disputeCurrencyOptions}
                value={disputeModel.currency || 'ALL'}
                onChange={(value: FilterChangeValue) => onDisputeFilterChange({ field: 'currency', value })}
              />
            </div>
          </div>
        </TabPanel>
      </TabPanels>
    </Tabs>
  );
};

export default connect(stateProps, dispatchProps)(TransferFinderModal);
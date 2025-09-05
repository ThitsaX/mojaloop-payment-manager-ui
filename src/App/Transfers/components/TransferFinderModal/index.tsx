import React, { FC, useState, useEffect, useCallback, useRef } from 'react';
import { connect } from 'react-redux';
import { State, Dispatch } from 'store/types';
import { AliasType, TransferDirection, TransferStatus } from 'App/types';
import {
  DataLabel,
  DatePicker,
  Link,
  ErrorBox,
  Modal,
  FormInput,
  Row,
  Column,
  Select,
  Spinner,
  Tabs,
  Tab,
  TabList,
  TabPanels,
  TabPanel,
  Button,
  PaginatedTable,
} from 'components';
import xlsx from 'xlsx';
import JSZip from 'jszip';
import axios from 'axios';
import * as actions from '../../actions';
import * as selectors from '../../selectors';
import { Transfer, TransferError, TransferFilter, DateRange } from '../../types';
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
  apiBaseUrl: state.app.config.apiBaseUrl,
});

const dispatchProps = (dispatch: Dispatch) => ({
  onModalCloseClick: () => dispatch(actions.toggleTransferFinderModal()),
  onFiltersSubmitClick: (filters: TransferFilter, pagination?: { offset: number; limit: number }) =>
    dispatch(actions.requestTransfers({ filters, pagination })),
  onTransfersSubmitClick: () => dispatch(actions.unrequestTransfers()),
  onFilterChange: ({ field, value }: { field: string; value: FilterChangeValue }) =>
    dispatch(actions.setTransferFinderFilter({ field, value })),
  onTransferRowClick: (transferError: TransferError) => {
    dispatch(actions.requestTransferDetails({ transferId: transferError.id }));
  },
  onRequestTransfersCount: (filters: TransferFilter) => 
    dispatch(actions.requestTransfersCount({ filters })),
});

interface TransferFinderModalProps {
  model: TransferFilter;
  transfers: Transfer[];
  transfersError: string | null;
  isTransfersPending: boolean;
  isTransfersRequested: boolean;
  transfersCount: number;
  isTransfersCountPending: boolean;
  apiBaseUrl: string;
  onFiltersSubmitClick: (filters: TransferFilter, pagination?: { offset: number; limit: number }) => void;
  onTransfersSubmitClick: () => void;
  onModalCloseClick: () => void;
  onFilterChange: ({ field, value }: { field: string; value: FilterChangeValue }) => void;
  onTransferRowClick: (transferError: TransferError) => void;
  onRequestTransfersCount: (filters: TransferFilter) => void;
}

function buildTransferApiUrl(filters: TransferFilter, offset: number, limit: number, apiBaseUrl: string): string {
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
  
  params.append('offset', offset.toString());
  params.append('limit', limit.toString());
  
  const fullUrl = `${baseUrl}?${params.toString()}`;
  console.log('Chunked download API URL:', fullUrl); // Debug log
  return fullUrl;
}

// Helper function to fetch transfers data for a specific chunk using direct fetch
async function fetchTransferChunk(
  filters: TransferFilter, 
  offset: number, 
  limit: number,
  apiBaseUrl: string,
  maxRetries: number = 2,
  progressCallback?: (stage: string) => void
): Promise<any[]> {
  let retryCount = 0;
  
  while (retryCount <= maxRetries) {
    try {
      const url = buildTransferApiUrl(filters, offset, limit, apiBaseUrl);
      
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
        // Check if this is a retryable error (503, 502, 504, network errors)
        if ((response.status === 503 || response.status === 502 || response.status === 504) && retryCount < maxRetries) {
          retryCount++;
          if (progressCallback) {
            progressCallback(`Retrying chunk (offset: ${offset}) - attempt ${retryCount}/${maxRetries}`);
          }
          // Exponential backoff: wait 1s, then 2s
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount - 1) * 1000));
          continue;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return response.data;
    } catch (error) {
      // Network errors or other exceptions
      if (retryCount < maxRetries && (error.code === 'NETWORK_ERROR' || error.message.includes('503') || error.message.includes('502') || error.message.includes('504'))) {
        retryCount++;
        if (progressCallback) {
          progressCallback(`Retrying chunk (offset: ${offset}) - attempt ${retryCount}/${maxRetries}`);
        }
        // Exponential backoff: wait 1s, then 2s
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount - 1) * 1000));
        continue;
      }
      throw new Error(`Failed to fetch chunk (offset: ${offset}): ${error.message}`);
    }
  }
  
  throw new Error(`Failed to fetch chunk (offset: ${offset}) after ${maxRetries} retries`);
}

// Helper function to generate Excel file for a chunk
function generateExcelFileForChunk(
  transfers: any[], 
  chunkIndex: number
): { filename: string; content: ArrayBuffer } {
  const ws = xlsx.utils.json_to_sheet(transfers);
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
async function downloadTransfersToExcel(transfers: any): Promise<void> {
  const ws = xlsx.utils.json_to_sheet(transfers);
  const wscols = [{ wch: 20 }];
  ws['!cols'] = wscols;
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, 'Transfers');
  const fileName: string = `Payment_Manager_Transfers_${new Date().toDateString()}.xlsx`;
  xlsx.writeFile(wb, fileName);
}

const TransferFinderModal: FC<TransferFinderModalProps> = ({
  model,
  transfers,
  transfersError,
  isTransfersPending,
  isTransfersRequested,
  transfersCount,
  isTransfersCountPending,
  apiBaseUrl,
  onFiltersSubmitClick,
  onTransfersSubmitClick,
  onModalCloseClick,
  onFilterChange,
  onTransferRowClick,
  onRequestTransfersCount,
}) => {
  const [pagination, setPagination] = useState({ offset: 0, limit: 20 });
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isDownloadingExcel, setIsDownloadingExcel] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState({ current: 0, total: 0, stage: 'Initializing...' });
  const maxRetries = 2;
  const RECORDS_PER_FILE = 10000; // Max 10K records per Excel file
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastRequestParamsRef = useRef<{ filters: TransferFilter; pagination?: { offset: number; limit: number } } | null>(null);

  useEffect(() => {
    if (isTransfersRequested) {
      onRequestTransfersCount(model);
    }
  }, [isTransfersRequested, model, onRequestTransfersCount]);

  // Auto-retry when there's an error
  useEffect(() => {
    if (transfersError && !isTransfersPending && retryCount < maxRetries && lastRequestParamsRef.current && !isRetrying) {
      setIsRetrying(true);
      retryTimeoutRef.current = setTimeout(() => {
        setRetryCount(prev => prev + 1);
        const { filters, pagination: retryPagination } = lastRequestParamsRef.current!;
        onFiltersSubmitClick(filters, retryPagination);
        setIsRetrying(false);
      }, 1000); // Wait 1 second before retry
    }
  }, [transfersError, isTransfersPending, retryCount, maxRetries, onFiltersSubmitClick, isRetrying]);

  useEffect(() => {
    if (!transfersError && !isTransfersPending && retryCount > 0) {
      setRetryCount(0);
    }
  }, [transfersError, isTransfersPending, retryCount]);

  // Cleanup timeout
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  const handlePageChange = (newPagination: { offset: number; limit: number }) => {
    setPagination(newPagination);
    lastRequestParamsRef.current = { filters: model, pagination: newPagination };
    setRetryCount(0); // Reset retry count for new requests
    onFiltersSubmitClick(model, newPagination);
  };

  const handleManualRetry = useCallback(() => {
    if (lastRequestParamsRef.current) {
      setRetryCount(0);
      const { filters, pagination: retryPagination } = lastRequestParamsRef.current;
      onFiltersSubmitClick(filters, retryPagination);
    }
  }, [onFiltersSubmitClick]);

  // Main chunked Excel download function
  const handleChunkedExcelDownload = useCallback(async () => {
    if (isDownloadingExcel || transfersCount === 0) return;
    
    setIsDownloadingExcel(true);
    setDownloadProgress({ current: 0, total: 0, stage: 'Initializing...' });
    
    try {
      const totalRecords = transfersCount;
      const totalChunks = Math.ceil(totalRecords / RECORDS_PER_FILE);
      
      // If total records <= 10K, use single file download
      if (totalRecords <= RECORDS_PER_FILE) {
        setDownloadProgress({ current: 1, total: 1, stage: 'Creating single Excel file...' });
        try {
          const singleChunkData = await fetchTransferChunk(
            model, 
            0, 
            totalRecords, 
            apiBaseUrl, 
            2, // maxRetries
            (retryStage: string) => {
              setDownloadProgress({ current: 1, total: 1, stage: retryStage });
            }
          );
          await downloadTransfersToExcel(singleChunkData);
          setDownloadProgress({ current: 1, total: 1, stage: 'Download complete!' });
        } catch (error) {
          console.log('Direct fetch failed, using current page data');
          await downloadTransfersToExcel(transfers);
          setDownloadProgress({ current: 1, total: 1, stage: 'Download complete (current page)!' });
        }
        return;
      }
      
      // For large datasets, inform user about alternative approach
      if (totalRecords > RECORDS_PER_FILE) {
        setDownloadProgress({ 
          current: 0, 
          total: totalChunks, 
          stage: `Large dataset detected (${totalRecords.toLocaleString()} records). Attempting chunked download...` 
        });
        
        const allFiles: { filename: string; content: ArrayBuffer }[] = [];
        let successfulChunks = 0;
        
        // Fetch and process each chunk
        for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
          const offset = chunkIndex * RECORDS_PER_FILE;
          const limit = Math.min(RECORDS_PER_FILE, totalRecords - offset);
          
          setDownloadProgress({ 
            current: chunkIndex + 1, 
            total: totalChunks, 
            stage: `Processing file ${chunkIndex + 1} of ${totalChunks} (${limit} records)...` 
          });
          
          try {
            // Fetch data for this chunk with progress callback for retry information
            const chunkData = await fetchTransferChunk(
              model, 
              offset, 
              limit, 
              apiBaseUrl, 
              2, // maxRetries
              (retryStage: string) => {
                setDownloadProgress({ 
                  current: chunkIndex + 1, 
                  total: totalChunks, 
                  stage: retryStage 
                });
              }
            );
            
            if (chunkData.length === 0) {
              console.warn(`Chunk ${chunkIndex + 1} returned no data, skipping...`);
              continue;
            }
            
            // Generate Excel file for this chunk
            const excelFile = generateExcelFileForChunk(chunkData, chunkIndex + 1);
            allFiles.push(excelFile);
            successfulChunks++;
            
          } catch (chunkError) {
            console.error(`Failed to process chunk ${chunkIndex + 1}:`, chunkError);
            // Continue with other chunks instead of failing completely
            continue;
          }
          
          // delay to prevent api spike
          if (chunkIndex < totalChunks - 1) {
            await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay between chunks
          }
        }
        
        if (allFiles.length === 0) {
          throw new Error('Unable to fetch chunk data. Please try downloading current page data instead.');
        }
        
        // Create and download ZIP file (atomic operation)
        setDownloadProgress({ 
          current: totalChunks, 
          total: totalChunks, 
          stage: `Creating ZIP file with ${allFiles.length} Excel files...` 
        });
        
        await downloadZipFile(allFiles);
        
        setDownloadProgress({ 
          current: totalChunks, 
          total: totalChunks, 
          stage: `Download complete! ${allFiles.length} of ${totalChunks} files in ZIP.` 
        });
      }
      
    } catch (error) {
      console.error('Chunked Excel download failed:', error);
      setDownloadProgress({ current: 0, total: 0, stage: `Error: ${error.message}` });
      
      // Show error to user for a few seconds, then reset
      setTimeout(() => {
        setDownloadProgress({ current: 0, total: 0, stage: '' });
      }, 5000);
    } finally {
      // Reset download state after a delay
      setTimeout(() => {
        setIsDownloadingExcel(false);
        setDownloadProgress({ current: 0, total: 0, stage: '' });
      }, 3000);
    }
  }, [model, transfersCount, isDownloadingExcel, RECORDS_PER_FILE, transfers]);

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
      func: helpers.toTransfersDate,
    },
  ];

  if (!isTransfersRequested) {
    content = <TransferFilters model={model} onFilterChange={onFilterChange} />;
    onSubmit = () => {
      const initialPagination = { offset: 0, limit: 20 };
      setPagination(initialPagination);
      lastRequestParamsRef.current = { filters: model, pagination: initialPagination };
      setRetryCount(0); // Reset retry count for new requests
      onFiltersSubmitClick(model, initialPagination);
    };
    submitLabel = 'Find Transfers';
  } else if (transfersError || isTransfersPending) {
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
        const isRetryableError = transfersError?.includes('503');
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
  } else {
    content = (
      <div className="transfers__transfers__list">
        {transfers.length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              {transfersCount > 20 && (
                <Button
                  label={isDownloadingExcel ? 'Preparing Download...' : `Download All (${transfersCount.toLocaleString()} records)`}
                  noFill
                  onClick={handleChunkedExcelDownload}
                  disabled={isDownloadingExcel || isTransfersPending}
                />
              )}
              <Button
                label={transfersCount <= 20 ? "Download Results" : "Download Current Page"}
                onClick={() => downloadTransfersToExcel(transfers)}
                disabled={isDownloadingExcel || isTransfersPending}
                style={{ fontSize: '12px', padding: '6px 12px' }}
                noFill
              />
            </div>
            {/* Download progress display */}
            {isDownloadingExcel && downloadProgress.stage && (
              <div style={{
                background: '#f8f9fa',
                border: '1px solid #e9ecef',
                borderRadius: '8px',
                padding: '16px',
                marginTop: '12px',
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
            )}
          </div>
        )}
        <PaginatedTable
          columns={transfersColumns}
          data={transfers}
          pagination={pagination}
          totalCount={transfersCount}
          isLoading={isTransfersPending || isDownloadingExcel}
          isLoadingCount={isTransfersCountPending}
          onRowClick={onTransferRowClick}
          onPageChange={handlePageChange}
          showRowNumbers={true}
        />
      </div>
    );
    onSubmit = onTransfersSubmitClick;
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

interface TransferFiltersProps {
  model: TransferFilter;
  onFilterChange: ({ field, value }: { field: string; value: FilterChangeValue }) => void;
}

const TransferFilters: FC<TransferFiltersProps> = ({ model, onFilterChange }) => (
  <Tabs>
    <TabList>
      <Tab>Basic Find a Transfer</Tab>
      <Tab>Advanced Filtering</Tab>
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
        <br />
        <Row>
          <Column>
            <DataLabel size="m">Approximate time of transfer</DataLabel>
            <Row>
              <Column>
                <Select
                  id="find-transfer-modal__date"
                  placeholder="Date"
                  type="select"
                  style={{ width: '200px' }}
                  options={dateRanges}
                  selected={model.dates || ''}
                  onChange={(value: FilterChangeValue) => onFilterChange({ field: 'dates', value })}
                />
              </Column>
              <Column>
                <DatePicker
                  id="find-transfer-modal__from-date"
                  placeholder="From"
                  style={{ width: '250px' }}
                  withTime
                  value={model.from || ''}
                  onSelect={(value: FilterChangeValue) => onFilterChange({ field: 'from', value })}
                  format="x"
                />
              </Column>
              <Column>
                <DatePicker
                  id="find-transfer-modal__to-date"
                  placeholder="To"
                  style={{ width: '250px' }}
                  withTime
                  value={model.to || ''}
                  onSelect={(value: FilterChangeValue) => onFilterChange({ field: 'to', value })}
                  format="x"
                />
              </Column>
            </Row>
          </Column>
          <Column style={{ paddingLeft: '20px' }}>
            <FormInput
              id="find-transfer-modal__directionOfFunds"
              label="Direction of Funds"
              style={{ width: '250px' }}
              type="select"
              options={transferDirectionOfFunds}
              value={model.direction || TransferDirection.All}
              onChange={(value: FilterChangeValue) => onFilterChange({ field: 'direction', value })}
            />
          </Column>
        </Row>
        <br />
        <Row>
          <Column>
            <FormInput
              id="find-transfer-modal__aliasType"
              label="Payee Alias Type"
              type="select"
              style={{ width: '200px' }}
              options={aliasType}
              value={model.aliasType || null}
              onChange={(value: FilterChangeValue) => onFilterChange({ field: 'aliasType', value })}
            />
          </Column>
          <Column>
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
          </Column>
          <Column>
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
          </Column>
          <Column style={{ paddingLeft: '20px' }}>
            <span style={{ width: '250px' }}>&nbsp;</span>
          </Column>
        </Row>
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
    </TabPanels>
  </Tabs>
);

export default connect(stateProps, dispatchProps)(TransferFinderModal);
import React, { FC, useState, useEffect } from 'react';
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
  onFiltersSubmitClick: (filters: TransferFilter, pagination?: { offset: number; limit: number }) => void;
  onTransfersSubmitClick: () => void;
  onModalCloseClick: () => void;
  onFilterChange: ({ field, value }: { field: string; value: FilterChangeValue }) => void;
  onTransferRowClick: (transferError: TransferError) => void;
  onRequestTransfersCount: (filters: TransferFilter) => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  onFiltersSubmitClick,
  onTransfersSubmitClick,
  onModalCloseClick,
  onFilterChange,
  onTransferRowClick,
  onRequestTransfersCount,
}) => {
  const [pagination, setPagination] = useState({ offset: 0, limit: 20 });

  // Request count when transfers are requested
  useEffect(() => {
    if (isTransfersRequested) {
      onRequestTransfersCount(model);
    }
  }, [isTransfersRequested, model, onRequestTransfersCount]);

  const handlePageChange = (newPagination: { offset: number; limit: number }) => {
    setPagination(newPagination);
    onFiltersSubmitClick(model, newPagination);
  };

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
      setPagination({ offset: 0, limit: 20 });
      onFiltersSubmitClick(model, { offset: 0, limit: 20 });
    };
    submitLabel = 'Find Transfers';
  } else if (transfersError) {
    console.log('Transfer Error State:', transfersError);
    content = <ErrorBox>Transfer: Unable to load transfers - {transfersError}</ErrorBox>;
  } else if (isTransfersPending) {
    content = (
      <div className="transfers__transfers__loader">
        <Spinner size={20} />
      </div>
    );
  } else {
    content = (
      <div className="transfers__transfers__list">
        {transfers.length > 0 && (
          <Button
            label="Download Transfers"
            noFill
            onClick={() => downloadTransfersToExcel(transfers)}
            style={{ marginBottom: '16px' }}
          />
        )}
        <PaginatedTable
          columns={transfersColumns}
          data={transfers}
          pagination={pagination}
          totalCount={transfersCount}
          isLoading={isTransfersPending}
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
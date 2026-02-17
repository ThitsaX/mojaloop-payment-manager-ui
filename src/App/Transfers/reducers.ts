import moment from 'moment';
import {
  SET_TRANSFERS_ERRORS,
  SET_TRANSFERS_ERRORS_ERROR,
  TOGGLE_TRANSFERS_ERRORS_VIEW_ALL,
  SET_TRANSFERS_ERRORS_TYPE_FILTER,
  TOGGLE_TRANSFER_FINDER_MODAL,
  SET_TRANSFER_FINDER_FILTER,
  REQUEST_TRANSFERS,
  UNREQUEST_TRANSFERS,
  SET_TRANSFERS,
  SET_TRANSFERS_ERROR,
  SET_TRANSFERS_COUNT,
  SET_TRANSFERS_COUNT_ERROR,
  SET_TRANSFERS_STATUSES,
  SET_TRANSFERS_STATUSES_ERROR,
  SET_TRANSFERS_SUCCESS_PERC,
  SET_TRANSFERS_SUCCESS_PERC_ERROR,
  SET_TRANSFERS_AVG_TIME,
  SET_TRANSFERS_AVG_TIME_ERROR,
  TransfersActionTypes,
  TransfersState,
  DateRange,
  SET_TRANSFER_DETAILS,
  TOGGLE_TRANSFER_DETAILS_MODAL,
  REQUEST_DISPUTE_TRANSACTIONS,
  UNREQUEST_DISPUTE_TRANSACTIONS,
  SET_DISPUTE_TRANSACTIONS,
  SET_DISPUTE_TRANSACTIONS_ERROR,
  SET_DISPUTE_TRANSACTIONS_COUNT,
  SET_DISPUTE_TRANSACTIONS_COUNT_ERROR,
  SET_DISPUTE_FILTER,
} from './types';

const dateRanges = {
  TODAY: [moment().startOf('day').format('x'), moment().endOf('day').format('x')],
  PAST_48_HOURS: [moment().subtract(48, 'hours').format('x'), moment().format('x')],
  '1_WEEK': [
    moment().subtract(1, 'week').startOf('day').format('x'),
    moment().endOf('day').format('x'),
  ],
  '1_MONTH': [
    moment().subtract(1, 'month').startOf('day').format('x'),
    moment().endOf('day').format('x'),
  ],
  CUSTOM: [moment().startOf('day').format('x'), moment().endOf('day').format('x')],
};

function getFromDateBySelection(range: DateRange) {
  return parseInt(dateRanges[range][0], 10);
}

function getToDateBySelection(range: DateRange) {
  return parseInt(dateRanges[range][1], 10);
}

function getDisputeFilterInitialState() {
  return {
    dates: DateRange.Today,
    from: getFromDateBySelection(DateRange.Today),
    to: getToDateBySelection(DateRange.Today),
    direction: undefined,
    currency: undefined,
  };
}

function getTransferFinderFilterInitialState() {
  return {
    transferId: undefined,
    dates: DateRange.Today,
    from: getFromDateBySelection(DateRange.Today),
    to: getToDateBySelection(DateRange.Today),
    aliasType: undefined,
    payeeAlias: undefined,
    aliasSubValue: undefined,
    direction: undefined,
    institution: undefined,
    status: undefined,
  };
}

export const initialState: TransfersState = {
  transfersErrors: [],
  transfersErrorsError: null,
  isTransfersErrorsViewAllActive: false,
  transfersErrorsTypeFilter: undefined,
  isTransferFinderModalVisible: false,
  transferFinderFilter: getTransferFinderFilterInitialState(),
  isTransfersRequested: false,
  transfers: [],
  transfersError: null,
  transfersNextCursor: undefined,
  transfersHasMore: undefined,
  transfersCount: 0,
  isTransfersCountPending: false,
  transfersCountError: null,
  transfersStatuses: [],
  transfersStatusesError: null,
  transfersSuccessPercError: null,
  transfersAvgTimeError: null,
  isTransferDetailsModalVisible: false,
  transferDetailsError: null,
  disputeFilter: getDisputeFilterInitialState(),
  isDisputeRequested: false,
  disputeTransactions: [],
  disputeTransactionsError: null,
  disputeTransactionsNextCursor: undefined,
  disputeTransactionsHasMore: undefined,
  disputeTransactionsCount: 0,
  isDisputeTransactionsCountPending: false,
  disputeTransactionsCountError: null,
};

export default function transfersReducer(
  state = initialState,
  action: TransfersActionTypes
): TransfersState {
  switch (action.type) {
    case SET_TRANSFERS_ERRORS:
      return {
        ...state,
        transfersErrors: action.data,
      };
    case SET_TRANSFERS_ERRORS_ERROR:
      return {
        ...state,
        transfersErrorsError: action.error,
      };
    case TOGGLE_TRANSFERS_ERRORS_VIEW_ALL:
      return {
        ...state,
        isTransfersErrorsViewAllActive: !state.isTransfersErrorsViewAllActive,
        transfersErrorsTypeFilter: initialState.transfersErrorsTypeFilter,
      };
    case SET_TRANSFERS_ERRORS_TYPE_FILTER:
      return {
        ...state,
        transfersErrorsTypeFilter: action.filter,
      };
    case TOGGLE_TRANSFER_FINDER_MODAL: {
      return {
        ...state,
        isTransferFinderModalVisible: !state.isTransferFinderModalVisible,
        transferFinderFilter: getTransferFinderFilterInitialState(),
        isTransfersRequested: false,
        disputeFilter: getDisputeFilterInitialState(),
        isDisputeRequested: false,
        disputeTransactions: [],
        disputeTransactionsError: null,
        disputeTransactionsNextCursor: undefined,
        disputeTransactionsHasMore: undefined,
        disputeTransactionsCount: 0,
        disputeTransactionsCountError: null,
      };
    }
    case TOGGLE_TRANSFER_DETAILS_MODAL: {
      return {
        ...state,
        isTransferDetailsModalVisible: !state.isTransferDetailsModalVisible,
      };
    }
    case SET_TRANSFER_FINDER_FILTER: {
      const { field, value } = action;

      if (field === 'dates' && value) {
        return {
          ...state,
          transferFinderFilter: {
            ...state.transferFinderFilter,
            dates: value,
            from: getFromDateBySelection(value as DateRange),
            to: getToDateBySelection(value as DateRange),
          },
        };
      }
      if (field === 'from' || field === 'to') {
        return {
          ...state,
          transferFinderFilter: {
            ...state.transferFinderFilter,
            [field]: value,
            dates: 'CUSTOM',
          },
        };
      }
      return {
        ...state,
        transferFinderFilter: {
          ...state.transferFinderFilter,
          [field]: value,
        },
      };
    }
    case REQUEST_TRANSFERS:
      return {
        ...state,
        isTransfersRequested: true,
        transfersError: null, // Clear error when new request starts
      };
    case UNREQUEST_TRANSFERS:
      return {
        ...state,
        isTransfersRequested: false,
      };
    case SET_TRANSFERS:
      return {
        ...state,
        transfers: action.data,
        transfersNextCursor: action.nextCursor,
        transfersHasMore: action.hasMore,
        transfersError: null, // Clear error on successful fetch
      };
    case SET_TRANSFERS_ERROR:
      return {
        ...state,
        transfersError: action.error,
      };
    case SET_TRANSFERS_COUNT:
      return {
        ...state,
        transfersCount: action.count,
      };
    case SET_TRANSFERS_COUNT_ERROR:
      return {
        ...state,
        transfersCountError: action.error,
      };
    case SET_TRANSFERS_STATUSES:
      return {
        ...state,
        transfersStatuses: action.data,
      };
    case SET_TRANSFERS_STATUSES_ERROR:
      return {
        ...state,
        transfersStatusesError: action.error,
      };
    case SET_TRANSFERS_SUCCESS_PERC:
      return {
        ...state,
        transfersSuccessPerc: action.data,
      };
    case SET_TRANSFERS_SUCCESS_PERC_ERROR:
      return {
        ...state,
        transfersSuccessPercError: action.error,
      };
    case SET_TRANSFERS_AVG_TIME:
      return {
        ...state,
        transfersAvgTime: action.data,
      };
    case SET_TRANSFERS_AVG_TIME_ERROR:
      return {
        ...state,
        transfersAvgTimeError: action.error,
      };
    case SET_TRANSFER_DETAILS:
      return {
        ...state,
        transferDetails: action.data,
        isTransferDetailsModalVisible: true,
      };
    case SET_DISPUTE_FILTER: {
      const { field, value } = action;
      if (field === 'dates' && value) {
        return {
          ...state,
          disputeFilter: {
            ...state.disputeFilter,
            dates: value,
            from: getFromDateBySelection(value as DateRange),
            to: getToDateBySelection(value as DateRange),
          },
        };
      }
      if (field === 'from' || field === 'to') {
        return {
          ...state,
          disputeFilter: {
            ...state.disputeFilter,
            [field]: value,
            dates: 'CUSTOM',
          },
        };
      }
      return {
        ...state,
        disputeFilter: {
          ...state.disputeFilter,
          [field]: value,
        },
      };
    }
    case REQUEST_DISPUTE_TRANSACTIONS:
      return {
        ...state,
        isDisputeRequested: true,
        disputeTransactionsError: null,
      };
    case UNREQUEST_DISPUTE_TRANSACTIONS:
      return {
        ...state,
        isDisputeRequested: false,
      };
    case SET_DISPUTE_TRANSACTIONS:
      return {
        ...state,
        disputeTransactions: action.data,
        disputeTransactionsNextCursor: action.nextCursor,
        disputeTransactionsHasMore: action.hasMore,
        disputeTransactionsError: null,
      };
    case SET_DISPUTE_TRANSACTIONS_ERROR:
      return {
        ...state,
        disputeTransactionsError: action.error,
      };
    case SET_DISPUTE_TRANSACTIONS_COUNT:
      return {
        ...state,
        disputeTransactionsCount: action.count,
      };
    case SET_DISPUTE_TRANSACTIONS_COUNT_ERROR:
      return {
        ...state,
        disputeTransactionsCountError: action.error,
      };
    default:
      return state;
  }
}

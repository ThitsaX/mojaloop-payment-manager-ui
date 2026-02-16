import React, { FC } from 'react';
import './CursorPagination.scss';

interface CursorPaginationProps {
  currentCursor?: string;
  nextCursor?: string;
  hasMore?: boolean;
  recordsShown: number;
  pageSize: number;
  onPrevious: () => void;
  onNext: () => void;
  onPageSizeChange: (size: number) => void;
  isLoading?: boolean;
}

const CursorPagination: FC<CursorPaginationProps> = ({
  currentCursor,
  nextCursor,
  hasMore,
  recordsShown,
  pageSize,
  onPrevious,
  onNext,
  onPageSizeChange,
  isLoading = false,
}) => {
  const isFirstPage = !currentCursor;
  const isLastPage = !hasMore;

  return (
    <div className="cursor-pagination">
      <div className="cursor-pagination__nav">
        <button
          onClick={onPrevious}
          disabled={isFirstPage || isLoading}
          className="cursor-pagination__button"
          title={isFirstPage ? 'Already on first page' : 'Go to previous page'}
        >
          <span className="cursor-pagination__icon">‹</span>
          Previous
        </button>

        <div className="cursor-pagination__info">
          <span className="cursor-pagination__count">
            Showing <strong>{recordsShown}</strong> record{recordsShown !== 1 ? 's' : ''}
          </span>
          {hasMore && (
            <span className="cursor-pagination__more-indicator">
              · More available
            </span>
          )}
        </div>

        <button
          onClick={onNext}
          disabled={isLastPage || isLoading}
          className="cursor-pagination__button"
          title={isLastPage ? 'No more records' : 'Go to next page'}
        >
          Next
          <span className="cursor-pagination__icon">›</span>
        </button>
      </div>

      <div className="cursor-pagination__page-size">
        <label className="cursor-pagination__label">Records per page:</label>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(parseInt(e.target.value))}
          className="cursor-pagination__select"
          disabled={isLoading}
        >
          <option value="20">20</option>
          <option value="50">50</option>
          <option value="100">100</option>
          <option value="200">200</option>
          <option value="500">500</option>
          <option value="1000">1000</option>
        </select>
      </div>
    </div>
  );
};

export default CursorPagination;

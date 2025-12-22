import React, { FC, useState } from 'react';
import { Link, Spinner } from 'components';
import Pagination from '../Pagination';
import './PaginatedTable.scss';

interface Column {
  label: string;
  key: string;
  func?: (value: any, item: any) => React.ReactNode;
  sortable?: boolean;
}

interface PaginatedTableProps {
  columns: Column[];
  data: any[];
  pagination: {
    offset?: number;
    cursor?: string;
    limit: number;
  };
  totalCount: number;
  isLoading?: boolean;
  isLoadingCount?: boolean;
  onRowClick?: (item: any) => void;
  onPageChange: (pagination: { offset?: number; cursor?: string; limit: number }) => void;
  showRowNumbers?: boolean;
  nextCursor?: string; // For cursor-based pagination
  hasMore?: boolean; // For cursor-based pagination
}

const PaginatedTable: FC<PaginatedTableProps> = ({
  columns,
  data,
  pagination,
  totalCount,
  isLoading = false,
  isLoadingCount = false,
  onRowClick,
  onPageChange,
  showRowNumbers = false,
  nextCursor,
  hasMore,
}) => {
  // Support both offset-based and cursor-based pagination
  const currentPage = pagination.offset !== undefined
    ? Math.floor(pagination.offset / pagination.limit) + 1
    : 1;
  const [sortConfig, setSortConfig] = useState({ key: '', direction: 'asc' });

  const handlePageChange = (page: number, pageSize?: number) => {
    const newPageSize = pageSize || pagination.limit;

    // If using offset-based pagination
    if (pagination.offset !== undefined) {
      const newOffset = (page - 1) * newPageSize;
      onPageChange({ offset: newOffset, limit: newPageSize });
    } else {
      // For cursor-based pagination
      // Page direction: page > currentPage means "Next", page < currentPage means "Previous"
      if (page > currentPage) {
        // Next page - use nextCursor
        onPageChange({ cursor: nextCursor, limit: newPageSize });
      } else {
        // Previous page - go back to first page (we don't track previous cursors yet)
        onPageChange({ cursor: undefined, limit: newPageSize });
      }
    }
  };

  const handlePageSizeChange = (current: number, size: number) => {
    if (pagination.offset !== undefined) {
      onPageChange({ offset: 0, limit: size });
    } else {
      onPageChange({ cursor: undefined, limit: size }); // Reset to first page
    }
  };

  const handleSort = (columnKey: string) => {
    let direction = 'asc';
    if (sortConfig.key === columnKey && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key: columnKey, direction });
  };

  // Apply sorting if a sort configuration is set
  let sortedData = [...data];
  if (sortConfig.key && data.length > 0) {
    sortedData = data.sort((a: any, b: any) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      let comparison = 0;
      if (aValue > bValue) comparison = 1;
      if (aValue < bValue) comparison = -1;
      return sortConfig.direction === 'desc' ? comparison * -1 : comparison;
    });
  }

  if (isLoading) {
    return (
      <div className="paginated-table-loading">
        <Spinner size={100} />
      </div>
    );
  }

  return (
    <div className="paginated-table">
      <div className="paginated-table-wrapper">
        <table className="paginated-table-content">
          <thead>
            <tr>
              {showRowNumbers && (
                <th className="paginated-table-header paginated-table-row-number">
                  #
                </th>
              )}
              {columns.map((column) => (
                <th 
                  key={column.key} 
                  className={`paginated-table-header ${column.sortable ? 'sortable' : ''}`}
                  onClick={() => column.sortable && handleSort(column.key)}
                >
                  <div className="paginated-table-header-content">
                    {column.label}
                    {column.sortable && (
                      <div className="paginated-table-sort-indicators">
                        <div
                          className={`sort-arrow sort-arrow-up ${
                            sortConfig.key === column.key && sortConfig.direction === 'asc'
                              ? 'active'
                              : ''
                          }`}
                        />
                        <div
                          className={`sort-arrow sort-arrow-down ${
                            sortConfig.key === column.key && sortConfig.direction === 'desc'
                              ? 'active'
                              : ''
                          }`}
                        />
                      </div>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (showRowNumbers ? 1 : 0)} className="paginated-table-empty">
                  No data found
                </td>
              </tr>
            ) : (
              sortedData.map((item, index) => {
                const rowNumber = (pagination.offset ?? 0) + index + 1;
                return (
                  <tr
                    key={item.id || index}
                    className={`paginated-table-row ${onRowClick ? 'clickable' : ''}`}
                    onClick={() => onRowClick && onRowClick(item)}
                  >
                    {showRowNumbers && (
                      <td className="paginated-table-cell paginated-table-row-number">
                        {rowNumber}
                      </td>
                    )}
                    {columns.map((column) => (
                      <td key={column.key} className="paginated-table-cell">
                        {column.func
                          ? column.func(item[column.key], item)
                          : item[column.key] || ''
                        }
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {!isLoadingCount && totalCount > 0 && pagination.offset !== undefined && (
        <Pagination
          current={currentPage}
          total={totalCount}
          pageSize={pagination.limit}
          showSizeChanger
          showTotal={(total, range) => `${range[0]}-${range[1]} of ${total} transfers`}
          pageSizeOptions={['50', '100', '200', '500', '1000']}
          onChange={handlePageChange}
          onShowSizeChange={handlePageSizeChange}
        />
      )}

      {/* Cursor-based pagination controls */}
      {!isLoadingCount && pagination.offset === undefined && data.length > 0 && (
        <div className="paginated-table-cursor-controls">
          <div className="cursor-nav-buttons">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={!pagination.cursor}
              className="pagination-button"
            >
              Previous
            </button>
            <span className="pagination-info">
              Showing {data.length} records
              {hasMore && ' (more available)'}
            </span>
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={!hasMore}
              className="pagination-button"
            >
              Next
            </button>
          </div>
          <div className="cursor-page-size">
            <span className="page-size-label">Records per page:</span>
            <select
              value={pagination.limit}
              onChange={(e) => handlePageSizeChange(1, parseInt(e.target.value))}
              className="page-size-select"
            >
              <option value="20">20</option>
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="200">200</option>
              <option value="500">500</option>
            </select>
          </div>
        </div>
      )}

      {isLoadingCount && (
        <div className="paginated-table-count-loading">
          <Spinner size={16} /> Loading count...
        </div>
      )}
    </div>
  );
};

export default PaginatedTable;

import React, { FC } from 'react';
import { Link, Spinner } from 'components';
import Pagination from '../Pagination';
import './PaginatedTable.scss';

interface Column {
  label: string;
  key: string;
  func?: (value: any, item: any) => React.ReactNode;
}

interface PaginatedTableProps {
  columns: Column[];
  data: any[];
  pagination: {
    offset: number;
    limit: number;
  };
  totalCount: number;
  isLoading?: boolean;
  isLoadingCount?: boolean;
  onRowClick?: (item: any) => void;
  onPageChange: (pagination: { offset: number; limit: number }) => void;
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
}) => {
  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;

  const handlePageChange = (page: number, pageSize?: number) => {
    const newPageSize = pageSize || pagination.limit;
    const newOffset = (page - 1) * newPageSize;
    onPageChange({ offset: newOffset, limit: newPageSize });
  };

  const handlePageSizeChange = (current: number, size: number) => {
    onPageChange({ offset: 0, limit: size });
  };

  if (isLoading) {
    return (
      <div className="paginated-table-loading">
        <Spinner size={20} />
      </div>
    );
  }

  return (
    <div className="paginated-table">
      <div className="paginated-table-wrapper">
        <table className="paginated-table-content">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key} className="paginated-table-header">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="paginated-table-empty">
                  No data found
                </td>
              </tr>
            ) : (
              data.map((item, index) => (
                <tr
                  key={item.id || index}
                  className={`paginated-table-row ${onRowClick ? 'clickable' : ''}`}
                  onClick={() => onRowClick && onRowClick(item)}
                >
                  {columns.map((column) => (
                    <td key={column.key} className="paginated-table-cell">
                      {column.func 
                        ? column.func(item[column.key], item)
                        : item[column.key] || ''
                      }
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!isLoadingCount && totalCount > 0 && (
        <Pagination
          current={currentPage}
          total={totalCount}
          pageSize={pagination.limit}
          showSizeChanger
          showTotal={(total, range) => `${range[0]}-${range[1]} of ${total} transfers`}
          pageSizeOptions={['20', '50', '100', '200']}
          onChange={handlePageChange}
          onShowSizeChange={handlePageSizeChange}
        />
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
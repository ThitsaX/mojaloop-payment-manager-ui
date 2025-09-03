import React, { FC, useState } from 'react';
import { Link, Spinner } from 'components';
import { CaretUpOutlined, CaretDownOutlined } from '@ant-design/icons';
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
    offset: number;
    limit: number;
  };
  totalCount: number;
  isLoading?: boolean;
  isLoadingCount?: boolean;
  onRowClick?: (item: any) => void;
  onPageChange: (pagination: { offset: number; limit: number }) => void;
  showRowNumbers?: boolean;
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
}) => {
  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;
  const [sortConfig, setSortConfig] = useState({ key: '', direction: 'asc' });

  const handlePageChange = (page: number, pageSize?: number) => {
    const newPageSize = pageSize || pagination.limit;
    const newOffset = (page - 1) * newPageSize;
    onPageChange({ offset: newOffset, limit: newPageSize });
  };

  const handlePageSizeChange = (current: number, size: number) => {
    onPageChange({ offset: 0, limit: size });
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
                        <CaretUpOutlined
                          className={`sort-icon ${
                            sortConfig.key === column.key && sortConfig.direction === 'asc'
                              ? 'active'
                              : ''
                          }`}
                        />
                        <CaretDownOutlined
                          className={`sort-icon ${
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
                const rowNumber = pagination.offset + index + 1;
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
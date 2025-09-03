import React, { FC } from 'react';
import { Button, Select } from 'components';
import './Pagination.scss';

interface PaginationProps {
  current: number;
  total: number;
  pageSize: number;
  showSizeChanger?: boolean;
  showQuickJumper?: boolean;
  showTotal?: (total: number, range: [number, number]) => string;
  pageSizeOptions?: string[];
  onChange: (page: number, pageSize?: number) => void;
  onShowSizeChange?: (current: number, size: number) => void;
}

const Pagination: FC<PaginationProps> = ({
  current,
  total,
  pageSize,
  showSizeChanger = false,
  showQuickJumper = false,
  showTotal,
  pageSizeOptions = ['20', '50', '100', '200'],
  onChange,
  onShowSizeChange,
}) => {
  const totalPages = Math.ceil(total / pageSize);
  const start = (current - 1) * pageSize + 1;
  const end = Math.min(current * pageSize, total);

  const handlePrevious = () => {
    if (current > 1) {
      onChange(current - 1);
    }
  };

  const handleNext = () => {
    if (current < totalPages) {
      onChange(current + 1);
    }
  };

  const handlePageSizeChange = (value: string) => {
    const newSize = parseInt(value, 10);
    if (onShowSizeChange) {
      onShowSizeChange(1, newSize);
    }
    onChange(1, newSize);
  };

  const getVisiblePages = () => {
    const pages = [];
    const maxVisible = 5;
    
    let startPage = Math.max(1, current - 2);
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    
    if (endPage - startPage < maxVisible - 1) {
      startPage = Math.max(1, endPage - maxVisible + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    
    return pages;
  };

  const visiblePages = getVisiblePages();

  return (
    <div className="pagination-container">
      <div className="pagination-info">
        {showTotal && showTotal(total, [start, end])}
      </div>
      
      <div className="pagination-controls">
        <Button
          label="Previous"
          size="s"
          noFill
          disabled={current <= 1}
          onClick={handlePrevious}
        />
        
        {visiblePages[0] > 1 && (
          <>
            <Button
              label="1"
              size="s"
              noFill={current !== 1}
              onClick={() => onChange(1)}
            />
            {visiblePages[0] > 2 && <span className="pagination-ellipsis">...</span>}
          </>
        )}
        
        {visiblePages.map(page => (
          <Button
            key={page}
            label={page.toString()}
            size="s"
            noFill={current !== page}
            onClick={() => onChange(page)}
          />
        ))}
        
        {visiblePages[visiblePages.length - 1] < totalPages && (
          <>
            {visiblePages[visiblePages.length - 1] < totalPages - 1 && (
              <span className="pagination-ellipsis">...</span>
            )}
            <Button
              label={totalPages.toString()}
              size="s"
              noFill={current !== totalPages}
              onClick={() => onChange(totalPages)}
            />
          </>
        )}
        
        <Button
          label="Next"
          size="s"
          noFill
          disabled={current >= totalPages}
          onClick={handleNext}
        />
      </div>

      {showSizeChanger && (
        <div className="pagination-size-changer">
          <Select
            id="page-size-select"
            options={pageSizeOptions.map(size => ({ label: `${size} / page`, value: size }))}
            selected={pageSize.toString()}
            onChange={handlePageSizeChange}
          />
        </div>
      )}
    </div>
  );
};

export default Pagination;
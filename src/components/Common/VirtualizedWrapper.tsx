// src/components/Common/VirtualizedWrapper.tsx

import React, { forwardRef } from 'react';
import { Virtuoso, TableVirtuoso } from 'react-virtuoso';

interface CustomTableRowProps {
  context?: {
    data: any[];
    tableRowClassName?: (item: any, index: number, context: any) => string;
    onRowClick?: (item: any, index: number, context: any) => void;
    originalContext: any;
  };
  'data-index': number;
  children?: React.ReactNode;
  [key: string]: any;
}

// Custom TableRow component defined outside the render function to prevent performance loss
const CustomTableRow = forwardRef<HTMLTableRowElement, CustomTableRowProps>(
  ({ context, 'data-index': index, children, ...props }, ref) => {
    const item = context?.data?.[index];
    const customClass = context?.tableRowClassName
      ? context.tableRowClassName(item, index, context.originalContext)
      : '';
    const handleClick = (e: React.MouseEvent<HTMLTableRowElement>) => {
      if (context?.onRowClick && item !== undefined) {
        context.onRowClick(item, index, context.originalContext);
      }
      if (props.onClick) {
        props.onClick(e);
      }
    };

    return (
      <tr
        ref={ref}
        {...props}
        data-index={index}
        className={customClass}
        onClick={handleClick}
      >
        {children}
      </tr>
    );
  }
);

export interface VirtualizedWrapperProps<T, ContextType = any> {
  mode: 'list' | 'table';
  data: T[];
  itemContent: (index: number, item: T, context: ContextType) => React.ReactNode;

  // Table specific props
  fixedHeaderContent?: () => React.ReactNode;
  tableClassName?: string;
  tableBodyClassName?: string;
  tableRowClassName?: (item: T, index: number, context: ContextType) => string;
  onRowClick?: (item: T, index: number, context: ContextType) => void;

  // List specific props
  listClassName?: string;
  listStyle?: React.CSSProperties;

  // General props
  height?: string | number;
  followOutput?: boolean;
  context?: ContextType;
  useWindowScroll?: boolean;
}

export const VirtualizedWrapper = <T, ContextType = any>({
  mode,
  data,
  itemContent,
  fixedHeaderContent,
  tableClassName = "w-full text-left text-xs border-collapse",
  tableBodyClassName = "divide-y divide-[#2d2d2d] font-mono",
  tableRowClassName,
  onRowClick,
  listClassName,
  listStyle,
  height = "100%",
  followOutput = false,
  context,
  useWindowScroll = false,
}: VirtualizedWrapperProps<T, ContextType>) => {
  // Bundle helper context for the CustomTableRow component
  const rowContext = React.useMemo(() => ({
    data,
    tableRowClassName,
    onRowClick,
    originalContext: context,
  }), [data, tableRowClassName, onRowClick, context]);

  if (mode === 'table') {
    return (
      <div style={useWindowScroll ? {} : { height }} className="w-full relative overflow-hidden">
        <TableVirtuoso
          data={data}
          context={rowContext}
          fixedHeaderContent={fixedHeaderContent}
          itemContent={(index, item) => itemContent(index, item, context as ContextType)}
          followOutput={followOutput}
          useWindowScroll={useWindowScroll}
          components={{
            Table: (props) => <table {...props} className={tableClassName} />,
            TableBody: React.forwardRef<HTMLTableSectionElement, any>((props, ref) => (
              <tbody {...props} ref={ref} className={tableBodyClassName} />
            )),
            TableRow: CustomTableRow as any,
          }}
        />
      </div>
    );
  }

  return (
    <div style={useWindowScroll ? {} : { height }} className="w-full relative overflow-hidden">
      <Virtuoso
        data={data}
        context={context}
        itemContent={(index, item) => itemContent(index, item, context as ContextType)}
        followOutput={followOutput}
        useWindowScroll={useWindowScroll}
        className={listClassName}
        style={listStyle}
      />
    </div>
  );
};

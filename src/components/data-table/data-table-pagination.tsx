import type { ReactTable, RowData } from "@tanstack/react-table";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { useId } from "react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { dataTableFeatures } from "@/lib/data-table-features";
import { cn } from "@/lib/utils";

interface DataTablePaginationProps<TData extends RowData>
  extends React.ComponentProps<"div"> {
  table: ReactTable<typeof dataTableFeatures, TData>;
  pageSizeOptions?: number[];
  /**
   * Collapses the footer to a single row: page position and prev/next only.
   *
   * The full footer stacks four blocks vertically on a narrow screen — the
   * selected-row count, "Rows per page" with its select, "Page x of y", and the
   * buttons — which costs more height than the table itself. Opt-in and off by
   * default, so every existing table keeps the full footer.
   */
  compact?: boolean;
}

export function DataTablePagination<TData extends RowData>({
  table,
  pageSizeOptions = [10, 20, 30, 40, 50],
  compact = false,
  className,
  ...props
}: DataTablePaginationProps<TData>) {
  const rowsPerPageLabelId = useId();
  const pageSizeItems = pageSizeOptions.map((pageSize) => ({
    label: String(pageSize),
    value: String(pageSize),
  }));

  if (compact) {
    return (
      <div
        className={cn(
          "flex w-full items-center justify-between gap-2 p-1",
          className,
        )}
        {...props}
      >
        <table.Subscribe
          selector={(state) => ({
            pagination: state.pagination,
            rowSelection: state.rowSelection,
            columnFilters: state.columnFilters,
          })}
        >
          {(state) => {
            const selected = table.getFilteredSelectedRowModel().rows.length;
            const total = table.getFilteredRowModel().rows.length;
            return (
              <div className="whitespace-nowrap text-muted-foreground text-sm">
                {/* The selection count only earns its space once something is
                    selected; otherwise show what the list actually contains. */}
                {selected > 0
                  ? `${selected} of ${total} selected`
                  : `${total} total${
                      table.getPageCount() > 1
                        ? ` · page ${state.pagination.pageIndex + 1}/${table.getPageCount()}`
                        : ""
                    }`}
              </div>
            );
          }}
        </table.Subscribe>
        <div className="flex items-center gap-2">
          <Button
            aria-label="Go to previous page"
            variant="outline"
            size="icon"
            className="size-9"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft />
          </Button>
          <Button
            aria-label="Go to next page"
            variant="outline"
            size="icon"
            className="size-9"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex w-full flex-col-reverse items-center justify-between gap-4 overflow-auto p-1 sm:flex-row sm:gap-8",
        className,
      )}
      {...props}
    >
      <table.Subscribe
        selector={(state) => ({
          columnFilters: state.columnFilters,
          rowSelection: state.rowSelection,
        })}
      >
        {() => (
          <div className="flex-1 whitespace-nowrap text-muted-foreground text-sm">
            {table.getFilteredSelectedRowModel().rows.length} of{" "}
            {table.getFilteredRowModel().rows.length} row(s) selected.
          </div>
        )}
      </table.Subscribe>
      <div className="flex flex-col-reverse items-center gap-4 sm:flex-row sm:gap-6 lg:gap-8">
        <table.Subscribe source={table.atoms.pagination}>
          {(pagination) => (
            <>
              <div className="flex items-center gap-2">
                <p
                  id={rowsPerPageLabelId}
                  className="whitespace-nowrap font-medium text-sm"
                >
                  Rows per page
                </p>
                <Select
                  value={`${pagination.pageSize}`}
                  onValueChange={(value) => {
                    table.setPageSize(Number(value));
                  }}
                  items={pageSizeItems}
                >
                  <SelectTrigger
                    aria-labelledby={rowsPerPageLabelId}
                    className="h-8 w-18 data-size:h-8"
                  >
                    <SelectValue placeholder={pagination.pageSize} />
                  </SelectTrigger>
                  <SelectContent side="top">
                    <SelectGroup>
                      <SelectLabel>Rows per page</SelectLabel>
                      {pageSizeItems.map((pageSize) => (
                        <SelectItem key={pageSize.value} value={pageSize.value}>
                          {pageSize.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-center font-medium text-sm">
                Page {pagination.pageIndex + 1} of {table.getPageCount()}
              </div>
            </>
          )}
        </table.Subscribe>
        <div className="flex items-center gap-2">
          <Button
            aria-label="Go to first page"
            variant="outline"
            size="icon"
            className="hidden size-8 lg:flex"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronsLeft />
          </Button>
          <Button
            aria-label="Go to previous page"
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft />
          </Button>
          <Button
            aria-label="Go to next page"
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <ChevronRight />
          </Button>
          <Button
            aria-label="Go to last page"
            variant="outline"
            size="icon"
            className="hidden size-8 lg:flex"
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
          >
            <ChevronsRight />
          </Button>
        </div>
      </div>
    </div>
  );
}

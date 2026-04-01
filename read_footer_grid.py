import openpyxl

try:
    wb = openpyxl.load_workbook('근로소득_간이세액표(조견표).xlsx')
    sheet = wb.active
    
    start_row = 650
    end_row = 665
    
    for r in range(start_row, end_row + 1):
        row_vals = []
        for c in range(1, 12): # Columns A to K
            cell = sheet.cell(row=r, column=c)
            val = str(cell.value) if cell.value else ""
            row_vals.append(val[:20]) # Truncate for display
        print(f"R{r}: {'|'.join(row_vals)}")
            
except Exception as e:
    print(f"Error: {e}")

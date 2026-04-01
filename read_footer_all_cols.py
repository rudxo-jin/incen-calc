import openpyxl

try:
    wb = openpyxl.load_workbook('근로소득_간이세액표(조견표).xlsx')
    sheet = wb.active
    
    for r in range(651, 663):
        row_vals = []
        for c in range(1, 20): # Read up to column S
            cell = sheet.cell(row=r, column=c)
            if cell.value:
                row_vals.append(f"[{c}] {cell.value}")
        if row_vals:
            print(f"R{r}: {' '.join(row_vals)}")
            
except Exception as e:
    print(f"Error: {e}")

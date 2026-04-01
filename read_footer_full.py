import openpyxl

try:
    wb = openpyxl.load_workbook('근로소득_간이세액표(조견표).xlsx')
    sheet = wb.active
    
    # Rows 653 to 663 seem to contain the formulas based on previous attempts
    # Let's read a wider range to be safe
    for r in range(650, 665):
        row_text = []
        for c in range(1, 20):
            cell = sheet.cell(row=r, column=c)
            if cell.value:
                row_text.append(str(cell.value))
        
        full_text = " ".join(row_text)
        if full_text.strip():
            print(f"Row {r}: {full_text}")
            
except Exception as e:
    print(f"Error: {e}")

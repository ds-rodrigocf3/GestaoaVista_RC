$sh = New-Object -ComObject Shell.Application
$folder = $sh.NameSpace(10)
$found = $false
foreach($item in $folder.Items()) {
    if($item.Name -eq 'styles.css') {
        Write-Host "Found $($item.Name) in Recycle Bin!"
        
        # Try to restore it (verb trick might not work depending on OS lang), instead just copy it to current dir
        $dest = Get-Location
        $shell = New-Object -ComObject Shell.Application
        $destFolder = $shell.NameSpace($dest.Path)
        $destFolder.CopyHere($item)
        Write-Host "Restored styles.css!"
        $found = $true
        break
    }
}
if(-not $found) {
    Write-Host "Not found in recycle bin."
}

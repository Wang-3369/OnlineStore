from PIL import Image
import io

def compress_image(image_file, max_size=(800, 800), quality=70):
    """
    將圖片縮放並轉為 JPEG 格式壓縮，減少檔案體積。
    """
    img = Image.open(image_file)
    
    # 轉為 RGB 模式 (防止 RGBA 轉 JPEG 報錯)
    if img.mode in ("RGBA", "P"):
        img = img.convert("RGB")
    
    # 等比例縮放至指定大小以內
    img.thumbnail(max_size, Image.Resampling.LANCZOS)
    
    # 輸出到記憶體
    output = io.BytesIO()
    img.save(output, format="JPEG", quality=quality, optimize=True)
    output.seek(0)
    return output
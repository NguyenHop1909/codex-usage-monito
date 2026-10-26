# Codex Usage Monitor (Windows)

Tiện ích chạy nền ở system tray, đọc phần trăm còn lại từ trang **ChatGPT Settings → Usage**, tự làm mới mỗi 5 phút và gửi thông báo Windows khi còn 20%, 10% hoặc 5%.

## Chạy thử

Yêu cầu Node.js 20+:

```powershell
npm install
npm start
```

Lần đầu, bấm **Kết nối lại tài khoản** và đăng nhập ChatGPT trong cửa sổ mở ra. Ngay khi đọc được hạn mức, trang web tự ẩn; các lần sau ứng dụng chỉ hiện bảng theo dõi và chạy dưới system tray. Session được Electron lưu cục bộ trong profile ứng dụng; chương trình không ghi mật khẩu, cookie hay token vào log.

Ứng dụng dùng chế độ theo dõi hybrid để giảm tài nguyên. Bình thường Chrome monitor chỉ được mở theo chu kỳ đã chọn, đọc hạn mức rồi đóng. Khi bật **Đang dùng Codex**, Chrome monitor được giữ chạy ẩn và dữ liệu được cập nhật mỗi 30 giây; tắt tùy chọn này để quay lại chế độ tiết kiệm.

## Đóng gói file Windows

```powershell
npm run dist
```

File portable và bộ cài sẽ nằm trong thư mục `dist`. Sau khi chạy, ứng dụng tự đăng ký mở cùng Windows và thu nhỏ xuống khay hệ thống khi đóng cửa sổ.

## Lưu ý

- Công cụ đọc giao diện trang Usage, không gọi API nội bộ không được công bố.
- Nếu ChatGPT đổi nội dung/DOM của trang Usage, bộ đọc trong `src/main.js` có thể cần cập nhật.
- Dữ liệu chỉ nằm trên máy của bạn.

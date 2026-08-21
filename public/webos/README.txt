3 file ảnh dùng khi đóng gói app lên TV LG webOS (xem Bước E trong README.md chính):

- icon.png       80x80px      — icon hiển thị trong menu Launcher của TV
- largeIcon.png  130x130px    — icon lớn hơn, dùng ở 1 số màn hình
- splash.png     1920x1080px  — ảnh nền lúc app đang khởi động (splash screen)

Cả 3 file đã có sẵn (logo Ytube — khối đỏ bo góc + tam giác play trắng, trên nền tối
#0e0f13, giống hệt logo trong app). Muốn đổi logo riêng thì thay 3 file này bằng ảnh
của bạn — GIỮ ĐÚNG kích thước và định dạng PNG ở trên — rồi chạy lại:

  npm run build:webos
  ares-package ./dist

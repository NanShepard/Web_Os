# Báo Cáo Quá Trình Hiện Thực Hóa Ứng Dụng: NexOS Cloud
*(Tài liệu tham khảo chi tiết các bước xây dựng, thiết kế và tối ưu hệ thống dành cho báo cáo chuyên đề / đồ án giảng viên)*

---

## Lời Mở Đầu: Mục Tiêu Dự Án
Dự án **NexOS Cloud** ra đời với ý tưởng kết hợp trải nghiệm của một Hệ điều hành ngay trên nền tảng Web (Web OS) và một hệ thống đồng bộ hóa dữ liệu đám mây liền mạch (Cloud Storage). Mục tiêu cốt lõi không chỉ là giao diện đẹp mắt mà còn đòi hỏi cấu trúc chịu tải tốt, quản lý tệp phức tạp, bảo mật đa người dùng và khả năng đưa lên môi trường server thực tế.

Dưới đây là các minh chứng và chi tiết tiến trình xây dựng hệ thống theo mô hình kiến trúc phần mềm chuyên môn.

---

## Bước 1: Thiết kế Kiến trúc Client-side (Trải nghiệm Desktop ảo)
Thay vì sử dụng các framework UI phức tạp như React hay Vue, dự án theo đuổi **Vanilla JavaScript** nhằm tối đa hiệu năng, hạn chế độ trễ và hiểu sâu về DOM Manipulation, tái hiện hệ điều hành Windows sát thực tế nhất.

1. **Window Manager (Nhân xử lý đồ hoạ cửa sổ)**: 
   - Viết các custom Controller để khai báo cửa sổ (`WebOS.WindowManager.createWindow`). 
   - Tính toán hệ tọa độ toạ độ `(X, Y)` để có tính năng "Kéo - Thả" (Drag & Drop), thu phóng (Maximize/Minimize).
   - Hệ thống đánh chỉ mục chiều sâu `z-index` thông minh: Cửa sổ nào click vào trễ nhất sẽ được trồi lên cao nhất, hệt như Windows.
2. **Hệ điều hành tập tin ảo (Virtual File System - VFS)**:
   - Xây dựng một logic ánh xạ thư mục tĩnh trực tiếp trong RAM trình duyệt thông qua `WebOS.FS`.
   - Lưu trữ tạm thời trạng thái các file ở LocalStorage trước khi chuyển tiếp lên máy chủ. Sự tách biệt này giúp Web OS vẫn hoạt động trơn tru ngay cả khi mạng lag (Offline-first approach).

---

## Bước 2: Xây dụng Core Server & Storage Layer (Node.js + REST API)
Đứng trước bài toán Backend lưu trữ nhiều file, hệ thống tiếp cận theo tiêu chuẩn **Decoupled Architecture** (Kiến trúc tách rời quy trình):

1. **Khởi tạo Express.js Server**: Quy hoạch thành các Endpoint rành mạch xử lý theo chuẩn RESTful: `POST /api/cloud/upload`, `GET /api/cloud/download`, `DELETE /api/cloud/delete`.
2. **Viết Middleware Xác Thực (Auth Middleware)**: Viết hàm `getUserRole` bóc tách thông tin từ request headers để đảm bảo tính an toàn. Không có user hợp lệ? Request bị ngắt rớt lập tức đạt tiêu chuẩn 401 Unauthorized.
3. **Storage Provider Layer**: 
   - Không lưu cấu trúc file dưới dạng thư mục lồng nhau (`C:/user/...`).
   - Mọi dữ liệu (Blob content - dù là hình ảnh hay text) đều được chuyển hoá (Checksum Base64) thành một tên vô nghĩa (`fileId`) và ném tất cả vào chung một bucket lớn là `cloud_data/`. 
   - Lợi ích: Chống triệt để chiêu trò **Directory Traversal Attack** (Tấn công leo thang thu mục) và sẵn sàng mô hình hóa như AWS S3.

---

## Bước 3: Di chuyển sang SQL và Mapping Metadata (Cơ Sở Dữ Liệu)
Ban đầu, hệ thống lưu tệp bằng JSON phẳng. Khi dự án lớn lên, thao tác truy xuất JSON trở nên quá chậm do phải tải toàn tệp vào RAM. Dự án tự nâng cấp kiến trúc đột phá:

1. **Thiết lập SQLite3**: Ràng buộc vật lý Database vào chung với Storage Container nhằm giữ cho cả hai "sống - chết" cùng lúc, tránh lệch pha dữ liệu.
2. **Schema Bảng `metadata`**: Đây là trái tim của hệ thống.
   - Thao tác: Lưu giữ con đường ảo `path` và ánh xạ với `fileId` vật lý thật sự.
   - Tối ưu hiệu năng: Nhờ lớp ảo hóa (Virtualization) này, nếu sinh viên B đổi tên một thư mục nặng 10 Gigabytes, phía Backend cực nhẹ. Chỉ cần Update thay tên đường dẫn dạng string trong bảng Metadata bằng SQL (`UPDATE path...`). Không một file 10GB nào bị copy paste vật lý. Tiết kiệm chi phí O(1) thay vì O(n).
3. **Tính nhất quán dữ liệu (Consistency)**: Chạy script migrate tự động để dọn dẹp các tệp mồ côi nếu DB và file vật lý không khớp lệch.

---

## Bước 4: Xây Dựng Logic Cơ Chế Phân Quyền & Chia sẻ mạng nội bộ (RBAC)
Một hệ điều hành Cloud thì phải có Users.

1. **Phân cực dữ liệu**: Query SQL lúc lấy Files: `WHERE owner = ?`. Đảm bảo sinh viên A không thể xem tài liệu của sinh viên B bằng cách đoán đường dẫn.
2. **Kiến trúc Chia sẻ (Shared Volume)**:
   - Nếu A tạo file trong `/shared/...`, Backend tự hiểu cờ Public được bật lên.
   - Khi đó Query `SELECT * FROM metadata` sẽ nới rộng logic để mọi User khác đều được fetch thông tin thư mục đó của A về để xem và tải xuống.
3. **Quyền Đặc Trị (Super Admin)**: Những ai mang role `Administrator` hay `Cloud Operator` có query riêng mở toàn cục. Mọi tệp trên hệ thống đều là tệp được chia sẻ ảo thông qua định danh đặc biệt `/shared/:owner/...`.

---

## Bước 5: Ứng dụng Real-time WebSocket (Đồng Bộ Thời Gian Thực)
Nếu User tải một tệp mới lên, ở trình duyệt của Admin chưa chắc thấy ngay mả phải ấn F5. Để giải quyết triệt để vấn đề này giống hệt Google Drive:

1. **Tích hợp mô đun Socket.io**.
2. Ngay ở dòng code sau khi SQL thực thi lệnh ánh xạ INESRT file thành công, Backend gọi phương thức broadcast: `io.emit('file_updated');`.
3. Frontend ở mọi client khác được thiết lập luôn chạy ngầm `socket.on('file_updated', refresh)`. 
4. Ngay khi có sự kiện, cửa sổ Web OS chớp nhẹ và tự lặp lại hàm fetch list files. Xóa nhoà hoàn toàn độ trễ hiển thị mà không cần Load lại trình duyệt.

---

## Bước 6: Đóng gói Container, sẵn sàng triển khai quy mô lớn (Docker & DevOps)
Một hệ thống chạy được trên Laptop là chưa đủ cho một đồ án tốt, nó phải dễ dàng được đưa lên Server từ xa (Data Center / VPS).

1. **Viết `Dockerfile`**: Đóng băng môi trường chạy phần mềm (Node.js 18 Alpine siêu nhẹ). Từ cấu hình hệ điều hành Linux cho tới lệnh chép source, cài `package.json` đều gói gọn trong 1 file cấu hình duy nhất. Mọi máy chủ Linux đều boot ra chung đúng 1 kết quả.
2. **Khai báo `docker-compose.yml`**:
   - Chỉ huy container nexos-backend chạy ở `Port: 8080`.
   - **Tối Ưu Data Persistence (Bảo lưu dữ liệu cứng)**: Để Container không reset trắng dữ liệu SQLite mỗi khi sập - một nguyên lý cốt tử của Volume được áp dụng: **Bind Mount**. Kéo ổ cứng của Server Vật lý (`./cloud_data`) cắm thẳng ống nối sang ổ cực của Container ảo (`/app/cloud_data`). Container vô tư sử dụng/chỉnh sửa nhưng một khi nó sập, dữ liệu vẫn neo chắc ở máy gốc.

---
**Kết Luận**  
Quy trình xây dựng đi từ một giao diện Web SPA cơ bản, cho đến hệ thống lưu dữ trữ Object Storage mô phỏng rút gọn, được quản trị dưới cơ sở dữ liệu quan hệ tối ưu hóa I/O, và an toàn đằng sau container cô lập toàn thư mục. Hệ thống hoàn toàn chứng minh khả năng đưa lên môi trường Internet mở rộn (Scalability).

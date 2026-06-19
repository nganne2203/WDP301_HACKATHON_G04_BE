# Workflow Dự Án Hackathon

## 1. Mục đích tài liệu

Tài liệu này mô tả rõ workflow nghiệp vụ và workflow hệ thống của dự án quản lý cuộc thi hackathon trong trạng thái kiến trúc hiện tại.

Mục tiêu của tài liệu:

- thống nhất cách hiểu giữa nghiệp vụ, backend, frontend và workflow tự động hóa
- mô tả luồng cuộc thi từ đầu đến cuối theo đúng định hướng hiện tại của dự án
- làm tài liệu tham chiếu cho thiết kế giao diện, tài liệu thuyết trình và infographic
- tách rõ phần nghiệp vụ cuộc thi với phần kỹ thuật hệ thống

---

## 2. Nguyên tắc nghiệp vụ cốt lõi

Các nguyên tắc dưới đây là phần quan trọng nhất của workflow hiện tại:

- Thí sinh phải được duyệt hợp lệ trước khi được tạo đội hoặc tham gia đội.
- Chỉ đội đủ điều kiện mới chiếm một slot chính thức của sự kiện.
- Khi đủ số lượng đội hợp lệ theo cấu hình sự kiện, hệ thống phải đóng đăng ký.
- Số lượng bảng thi hoặc bảng chấm là dữ liệu cấu hình theo từng sự kiện, không cố định.
- Việc random chia bảng phải được hoàn tất trước khi cuộc thi chính thức bắt đầu.
- Tùy theo timeline từng mùa, random chia bảng có thể diễn ra trước workshop hoặc sau workshop.
- Chia bảng theo 2 bước: `preview` rồi `confirm`.
- Sau khi `confirm`, đội hình vào bảng được xem là chính thức và có thể thông báo cho đội thi.
- Backend không chạy AI local runtime nặng.
- Các tác vụ automation và tích hợp AI/GitHub được điều phối qua `n8n`.
- Nếu workflow AI lỗi, hệ thống ưu tiên `retry` hoặc `manual re-dispatch` thay vì fallback sang local AI.
- AI chỉ đóng vai trò hỗ trợ kỹ thuật, không thay thế giám khảo trong việc chấm điểm chính thức.

---

## 3. Các vai trò trong hệ thống

### 3.1 Admin

Phụ trách cấu hình hệ thống, phân quyền, cấu hình tích hợp và giám sát vận hành tổng thể.

### 3.2 Coordinator

Phụ trách vận hành cuộc thi theo từng sự kiện:

- tạo sự kiện
- tạo git org
- quản lý timeline
- duyệt thí sinh
- theo dõi đội thi
- điều phối workshop
- chia bảng
- phân công giám khảo
- công bố kết quả

### 3.3 Participant

Là thí sinh tham gia cuộc thi. Thí sinh phải được duyệt trước khi tham gia luồng tạo đội.

### 3.4 Team Leader

Là thành viên đội có quyền tạo đội, mời thành viên, cập nhật thông tin đội và nộp bài.

### 3.5 Judge

Phụ trách xem đội được phân công, đánh giá submission, chấm điểm theo rubric và gửi nhận xét.

### 3.6 Backend

Phụ trách nghiệp vụ lõi:

- xác thực và phân quyền
- lưu trạng thái cuộc thi
- quản lý đội, workshop, vòng thi, bảng thi, chấm điểm, kết quả
- gửi trigger sang n8n
- nhận callback kết quả từ n8n

### 3.7 n8n

Phụ trách automation và orchestration:

- nhận trigger từ backend
- gọi GitHub
- chuẩn hóa dữ liệu xử lý
- điều phối AI nếu có
- callback trạng thái hoặc kết quả về backend

---

## 4. Workflow tổng thể của cuộc thi

Toàn bộ cuộc thi có thể chia thành 10 giai đoạn chính.

### Giai đoạn 1: Khởi tạo sự kiện

Coordinator hoặc Admin tạo sự kiện hackathon mới.

Thông tin có thể cấu hình:

- tên sự kiện
- mô tả
- học kỳ, mùa giải
- thời gian mở và đóng đăng ký
- thời gian check-in
- timeline workshop
- timeline thi
- timeline nộp bài
- timeline chấm điểm
- số lượng đội tối đa
- số lượng thành viên tối thiểu và tối đa mỗi đội
- số lượng bảng thi hoặc bảng chấm
- sức chứa tối đa của mỗi bảng
- số lượng đội vào vòng sau
- rubric chấm điểm
- quy tắc tie-break nếu có

Ý nghĩa nghiệp vụ:

- Mỗi sự kiện có thể có cấu hình khác nhau.
- Không được hard-code số bảng, số đội hay số đội vào chung kết.

### Giai đoạn 2: Đăng ký tài khoản thí sinh

Thí sinh tạo tài khoản hoặc đăng nhập để đăng ký tham gia sự kiện.

Hệ thống ghi nhận:

- thông tin cá nhân
- thông tin sinh viên
- trạng thái đăng ký
- trạng thái chờ duyệt

Lúc này thí sinh chưa được tự tạo đội ngay nếu chưa được duyệt.

### Giai đoạn 3: Duyệt thí sinh

Ban tổ chức hoặc Coordinator xét duyệt hồ sơ thí sinh.

Kết quả có thể là:

- `PENDING`
- `APPROVED`
- `REJECTED`

Chỉ thí sinh `APPROVED` mới được:

- tạo đội
- tham gia đội
- nhận lời mời vào đội
- tiếp tục các bước tiếp theo của cuộc thi

Đây là điểm chặn nghiệp vụ rất quan trọng.

### Giai đoạn 4: Tạo đội và hoàn thiện hồ sơ đội

Sau khi được duyệt, thí sinh có thể:

- tạo đội mới
- tham gia đội qua lời mời
- trở thành đội trưởng hoặc thành viên

Đội cần hoàn thiện các thông tin cần thiết:

- tên đội
- trưởng nhóm
- danh sách thành viên
- thông tin dự án cơ bản
- track hoặc chapter nếu sự kiện yêu cầu
- repository GitHub nếu có ở giai đoạn này

Lưu ý:

- chưa phải đội nào cũng được tính là đã chiếm slot
- đội chỉ chiếm slot khi đạt đủ điều kiện hợp lệ theo cấu hình sự kiện

### Giai đoạn 5: Xét đội hợp lệ và chiếm slot chính thức

Hệ thống hoặc Coordinator kiểm tra từng đội có đủ điều kiện không.

Các điều kiện điển hình:

- đủ số lượng thành viên tối thiểu
- thành viên đều hợp lệ
- có trưởng nhóm
- có đủ thông tin đội
- có đủ thông tin dự án theo yêu cầu

Khi đội đạt đủ điều kiện:

- đội được đánh dấu là đủ điều kiện
- đội chiếm một slot chính thức trong cuộc thi

Khi đội chưa đủ điều kiện:

- đội vẫn tồn tại trong hệ thống
- nhưng chưa được tính vào số slot chính thức đã sử dụng

### Giai đoạn 6: Đóng đăng ký khi đủ slot

Khi số đội hợp lệ đạt mức tối đa theo cấu hình sự kiện, hệ thống đóng đăng ký.

Ví dụ:

- sự kiện cấu hình tối đa `30` đội
- khi đủ `30` đội hợp lệ, hệ thống ngừng nhận thêm đội mới. Có thể ngừng nhận nếu hết thời gian đăng ký

Ý nghĩa nghiệp vụ:

- đội nào đủ điều kiện sớm thì giữ slot trước
- hệ thống quản lý slot theo điều kiện hợp lệ, không phải chỉ theo việc tạo đội

### Giai đoạn 7: Random chia bảng trước khi cuộc thi chính thức bắt đầu

Đây là bước rất quan trọng của workflow hiện tại.

Sau khi danh sách đội hợp lệ đã được chốt:

- Coordinator thực hiện random chia các đội vào bảng thi
- số lượng bảng do sự kiện cấu hình, không cố định
- mỗi bảng có giới hạn sức chứa riêng

Luồng chuẩn:

1. Backend lấy danh sách đội đủ điều kiện.
2. Hệ thống random phân bổ đội vào các bảng.
3. Hệ thống tạo `preview` để Coordinator xem trước.
4. Coordinator có thể random lại nếu chưa muốn chốt.
5. Coordinator nhấn `confirm` để xác nhận đội hình chính thức.
6. Backend lưu `boardNumber`, `board name`, `placement slot` cho từng đội.

Sau khi `confirm`:

- đội hình vào bảng được khóa ở mức nghiệp vụ
- có thể dùng để thông báo cho đội thi
- Coordinator có thể phân công giám khảo cho từng bảng ngay sau khi chốt bảng
- workshop, briefing hoặc các hoạt động tiếp theo có thể triển khai theo danh sách bảng đã chốt

Lưu ý:

- bước chia bảng phải hoàn tất trước khi bước vào ngày thi chính thức
- tùy mùa giải, chia bảng có thể diễn ra trước workshop hoặc sau workshop
- không đợi đến lúc chấm mới chia bảng
- không mặc định là 3 bảng; số bảng là dữ liệu cấu hình

### Giai đoạn 8: Workshop, thông báo bảng thi và chuẩn bị thi

Workshop và thông báo bảng là hai hoạt động có liên quan chặt chẽ, nhưng không bắt buộc có một thứ tự cố định cho mọi mùa giải.

Tùy timeline thực tế:

- workshop có thể diễn ra trước bước random chia bảng
- hoặc workshop có thể diễn ra sau khi đã chốt bảng

Điểm bắt buộc là:

- việc random và confirm bảng phải hoàn tất trước khi cuộc thi chính thức diễn ra
- đội thi cần biết bảng của mình trước khi bước vào ngày thi chính
- giám khảo có thể được phân công ngay sau khi bảng đã được xác nhận

Sau khi chia bảng chính thức:

- hệ thống có thể thông báo cho đội biết mình thuộc bảng nào
- Coordinator tổ chức workshop theo timeline
- đội thi tham gia workshop để nhận hướng dẫn, giải đáp và chuẩn bị kỹ thuật

Workshop có thể bao gồm:

- giới thiệu thể lệ
- hướng dẫn quy trình nộp bài
- hướng dẫn GitHub/repository
- chia sẻ kỹ thuật
- hỏi đáp với mentor hoặc ban tổ chức

Ở giai đoạn này, việc đội đã biết bảng của mình sẽ giúp công tác tổ chức thuận lợi hơn nếu timeline sự kiện yêu cầu thông báo sớm.

### Giai đoạn 9: Thi đấu, phát triển sản phẩm và nộp bài

Sau workshop, đội bắt đầu giai đoạn thực hiện sản phẩm.

Hoạt động chính:

- nhận đề hoặc xác nhận đề bài
- phát triển sản phẩm
- cập nhật repository GitHub
- nộp submission theo vòng
- cập nhật demo, report, presentation nếu yêu cầu

Backend quản lý:

- repository metadata
- submission status
- deadline theo round
- lịch sử nộp bài

### Giai đoạn 10: Chấm điểm, xếp hạng và công bố kết quả

Khi đến giai đoạn chấm:

- Coordinator phân công giám khảo cho từng bảng
- giám khảo chỉ xem được các đội thuộc bảng được giao
- giám khảo chấm theo rubric
- hệ thống lưu score sheet và các score theo từng tiêu chí
- hệ thống tổng hợp điểm
- xếp hạng theo round, track hoặc event
- chọn đội vào vòng sau nếu có
- công bố kết quả cuối cùng

Kết quả có thể gồm:

- điểm từng đội
- bảng xếp hạng
- danh sách đội vào vòng trong
- đội đạt giải
- lịch sử chấm điểm

---

## 5. Workflow chi tiết theo trục thời gian

Để dễ hình dung, workflow có thể tóm tắt theo thứ tự thời gian như sau:

1. Tạo sự kiện và cấu hình toàn bộ luật chơi.
2. Mở đăng ký cho thí sinh.
3. Thí sinh đăng ký tài khoản.
4. Ban tổ chức duyệt thí sinh.
5. Thí sinh đã duyệt tạo đội hoặc tham gia đội.
6. Đội hoàn thiện hồ sơ.
7. Hệ thống xác định đội nào đủ điều kiện.
8. Đội đủ điều kiện chiếm slot chính thức.
9. Khi đủ số đội hợp lệ, hệ thống đóng đăng ký.
10. Coordinator random chia các đội hợp lệ vào bảng.
11. Coordinator xem preview và confirm đội hình vào bảng.
12. Hệ thống thông báo đội thuộc bảng nào.
13. Tổ chức workshop theo timeline của sự kiện.
14. Coordinator phân công giám khảo cho từng bảng ngay sau khi chốt bảng nếu cần.
15. Hệ thống thông báo bảng thi cho đội hoặc cập nhật danh sách bảng chính thức.
16. Đội thi phát triển sản phẩm và nộp bài.
17. Hệ thống tiếp nhận submission và dữ liệu GitHub.
18. Giám khảo chấm theo rubric.
19. Hệ thống tổng hợp điểm, xếp hạng, công bố kết quả và trao giải.

---

## 6. Workflow chia bảng chuẩn theo nghiệp vụ hiện tại

Đây là phần cần được hiểu chính xác vì ảnh hưởng trực tiếp tới frontend và backend.

### 6.1 Khi nào được chia bảng

Chỉ chia bảng khi:

- sự kiện đã có danh sách đội hợp lệ đủ điều kiện
- số slot cần thiết đã được chốt hoặc ban tổ chức quyết định chốt danh sách
- vẫn còn nằm trong khoảng thời gian chuẩn bị trước khi cuộc thi chính thức bắt đầu

### 6.2 Dữ liệu đầu vào

Dữ liệu đầu vào của bước chia bảng gồm:

- `eventId`
- `roundId` hoặc ngữ cảnh vòng thi tương ứng
- danh sách đội đủ điều kiện
- số lượng bảng cấu hình
- sức chứa từng bảng

### 6.3 Cơ chế chia bảng

Hệ thống chia bảng ngẫu nhiên để đảm bảo công bằng.

Kết quả preview cần thể hiện:

- tổng số đội đủ điều kiện
- tổng số đội chưa đủ điều kiện
- danh sách bảng
- đội nằm trong từng bảng
- slot của đội trong từng bảng

### 6.4 Hai bước bắt buộc

#### Bước 1: Preview

Hệ thống chỉ dựng phương án chia bảng để xem trước.

Ở bước này:

- chưa lưu assignment chính thức
- có thể random lại
- Coordinator kiểm tra tính hợp lý

#### Bước 2: Confirm

Sau khi xác nhận:

- assignment được lưu xuống hệ thống
- mỗi đội có bảng chính thức
- UI có thể hiển thị danh sách bảng thật
- hệ thống có thể dùng dữ liệu này cho các bước tiếp theo
- Coordinator có thể gán `judgeIds` cho từng bảng ngay ở giai đoạn này

### 6.5 Ý nghĩa của placement slot

`placement slot` là vị trí của đội trong bảng sau random.

Ví dụ:

- bảng A có các slot từ 1 đến 10
- bảng B có các slot từ 1 đến 10
- bảng C có các slot từ 1 đến 10

Slot này giúp:

- hiển thị danh sách đội rõ ràng
- cố định thứ tự sau khi confirm
- tăng tính minh bạch khi cần đối chiếu

---

## 7. Workflow workshop trong bức tranh tổng thể

Workshop không nằm sau giai đoạn chấm.

Theo luồng hiện tại:

- workshop là hoạt động diễn ra trước cuộc thi chính thức hoặc ở giai đoạn chuẩn bị đầu kỳ thi
- workshop có thể diễn ra trước bước chia bảng hoặc sau bước chia bảng, tùy timeline từng mùa
- điều kiện bắt buộc là workshop không được làm thay đổi nguyên tắc phải chốt bảng trước giờ thi chính thức

Vai trò của workshop:

- onboarding cho đội
- thống nhất quy trình thi
- hướng dẫn cách dùng repository, submission, timeline
- giải đáp nghiệp vụ và kỹ thuật

Do đó, khi thiết kế infographic hoặc tài liệu, workshop nên được đặt:

- trong giai đoạn chuẩn bị cuối trước ngày thi
- gần bước random chia bảng
- nhưng không nên thể hiện cứng rằng workshop luôn đứng trước hoặc luôn đứng sau bước chia bảng

---

## 8. Workflow kỹ thuật Backend, n8n và GitHub

Đây là luồng kỹ thuật hỗ trợ nghiệp vụ, đặc biệt ở phần submission và AI-assisted review.

### 8.1 Vai trò của backend hiện tại

Backend hiện tại theo hướng mỏng hơn, tập trung vào:

- xác thực
- phân quyền
- validate dữ liệu
- lưu trạng thái nghiệp vụ
- gọi n8n khi cần automation
- nhận callback từ n8n

Backend không nên:

- chạy AI local runtime nặng
- tự đảm nhiệm toàn bộ logic phân tích repository phức tạp nếu đã chuyển sang n8n

### 8.2 Luồng tích hợp n8n

Luồng kỹ thuật chuẩn:

1. Backend phát sinh trigger từ một sự kiện nghiệp vụ hoặc GitHub webhook.
2. Backend gửi payload gọn sang n8n.
3. n8n tự lấy dữ liệu cần thiết từ GitHub hoặc nguồn liên quan.
4. n8n thực hiện automation, phân tích, hoặc điều phối AI bên ngoài.
5. n8n callback kết quả hoặc trạng thái về backend.
6. Backend lưu kết quả vào database.
7. Frontend đọc trạng thái mới từ backend.

### 8.3 Khi workflow n8n lỗi

Nếu n8n lỗi:

- hệ thống không fallback sang AI local runtime
- backend đánh dấu trạng thái cần retry hoặc manual re-dispatch

Các trạng thái vận hành nên gồm:

- `PENDING`
- `COMPLETED`
- `FAILED`
- `RETRY_PENDING`
- `MANUAL_REDISPATCH_REQUIRED`
- `SKIPPED`

Ý nghĩa:

- giảm tải cho worker backend
- tránh phát sinh xử lý AI nặng trong hệ thống chính
- giữ kiến trúc rõ ràng hơn

---

## 9. Workflow chấm điểm chính thức

Điểm chính thức luôn đến từ giám khảo, không đến từ AI.

Luồng chấm điểm:

1. Coordinator phân công giám khảo vào bảng. Bước này có thể được thực hiện ngay sau khi xác nhận chia bảng, không cần đợi đến lúc đội nộp bài.
2. Giám khảo mở danh sách đội thuộc bảng của mình.
3. Giám khảo xem submission, repository và dữ liệu liên quan.
4. Giám khảo chấm từng tiêu chí theo rubric.
5. Hệ thống lưu score sheet và các score chi tiết.
6. Hệ thống tính tổng điểm.
7. Hệ thống sinh ranking.

AI nếu có chỉ hỗ trợ:

- gợi ý rủi ro kỹ thuật
- tóm tắt thay đổi
- gợi ý câu hỏi cho giám khảo
- hỗ trợ quan sát repository

AI không được:

- chấm điểm chính thức
- quyết định đội thắng
- quyết định đội vào chung kết

---

## 10. Những điểm cần thể hiện rõ trên frontend

Để đúng workflow hiện tại, frontend nên phản ánh rõ các điểm sau:

- thí sinh chưa duyệt thì không được tạo hoặc tham gia đội
- trạng thái đội hợp lệ phải tách biệt với trạng thái đội vừa tạo
- phải có hiển thị số slot đã dùng và số slot còn lại
- khi đủ slot, form đăng ký cần phản ánh đã đóng
- màn hình chia bảng phải là luồng 2 bước: random preview rồi confirm
- sau confirm mới hiển thị board assignment chính thức
- sau confirm nên hỗ trợ phân công giám khảo ngay trên từng bảng hoặc từ màn hình coordinator
- nên có thông báo rõ đội đang thuộc bảng nào
- workshop phải xuất hiện đúng vị trí trong timeline cuộc thi
- dashboard chấm điểm phải phân biệt dữ liệu AI hỗ trợ với điểm chính thức

---

## 11. Tóm tắt workflow ngắn gọn

Nếu cần mô tả cực ngắn, workflow của dự án hiện tại là:

1. Tạo sự kiện và cấu hình luật chơi.
2. Thí sinh đăng ký và chờ duyệt.
3. Thí sinh được duyệt mới được tạo hoặc tham gia đội.
4. Đội đủ điều kiện mới chiếm slot chính thức.
5. Đủ slot thì hệ thống đóng đăng ký.
6. Coordinator random chia bảng trong giai đoạn chuẩn bị cuối, theo cơ chế preview rồi confirm.
7. Workshop có thể diễn ra trước hoặc sau bước chia bảng, nhưng đều phải trước cuộc thi chính thức.
8. Coordinator có thể phân công giám khảo ngay sau khi chốt bảng.
9. Hệ thống thông báo bảng cho đội thi và bước vào giai đoạn phát triển sản phẩm.
10. Đội nộp bài, backend điều phối automation qua n8n; giám khảo chấm theo rubric, hệ thống xếp hạng và công bố kết quả.

---

## 12. Kết luận

Workflow hiện tại của dự án không chỉ là luồng đăng ký và chấm điểm đơn giản, mà là một chuỗi vận hành hoàn chỉnh gồm:

- kiểm soát điều kiện tham gia
- quản lý slot thi
- chia bảng trong giai đoạn chuẩn bị cuối để ổn định tổ chức
- phân công giám khảo sớm ngay sau khi chốt bảng
- workshop đồng hành theo timeline từng mùa
- điều phối kỹ thuật qua n8n
- chấm điểm chính thức theo rubric
- tổng hợp và công bố kết quả minh bạch

Đây nên được xem là tài liệu workflow chuẩn để đội phát triển tiếp tục đồng bộ backend, frontend, tài liệu triển khai và infographic của dự án.

# SEAL Hackathon — Nghiệp vụ và hướng dẫn vận hành toàn diện

> Phiên bản tài liệu: 1.0 — 12/07/2026  
> Nguồn đối chiếu: mã nguồn Backend hiện tại.  
> Đối tượng: Admin, Ban tổ chức/Coordinator, Judge, Mentor, Speaker và Participant.  
> Quy ước quan trọng: phần **Hệ thống đang cưỡng chế** mô tả hành vi hiện có; phần **Quy trình vận hành bắt buộc** là checklist con người cần làm vì hệ thống chưa tự động hóa hoàn toàn.

## 1. Dự án dùng để làm gì?

SEAL Hackathon là hệ thống điều hành sự kiện hackathon từ lúc chuẩn bị đến khi công bố kết quả. Hệ thống quản lý:

- tài khoản, role và quyền;
- competition, track, timeline và workshop;
- đăng ký participant, lập team, lời mời và duyệt team;
- check-in QR/manual;
- mentor, chat giữa team và mentor;
- media/gallery;
- repository GitHub, quyền collaborator, webhook và AI technical review;
- round, rubric, judging board, submission và score sheet;
- ranking, finalist và kết quả công bố;
- notification, audit log và operation/job nền.

Hệ thống không chỉ là trang đăng ký. Nó là một chuỗi dữ liệu liên kết: **Competition → Team/Participant → Round/Board → Submission/Score → Ranking/Result**, kèm các hoạt động hỗ trợ như workshop, chat, media và GitHub.

## 2. Các role và trách nhiệm

### 2.1 ADMIN — Quản trị hệ thống

Admin có toàn bộ quyền. Trách nhiệm chính:

- cấu hình role/permission và tài khoản quản trị;
- tạo, sửa, xóa hoặc khôi phục cấu hình ở mức hệ thống;
- cấu hình dịch vụ ngoài: email, media storage, GitHub, Google, Redis/worker, n8n;
- hỗ trợ coordinator khi có sự cố cần override;
- xem audit log, operation, job lỗi và xử lý đối soát;
- bảo vệ secret, backup dữ liệu và kiểm soát môi trường production.

Admin không nên làm thay công việc vận hành hằng ngày nếu coordinator có thể thực hiện. Mọi override nhạy cảm cần có lý do và được ghi audit.

### 2.2 COMPETITION_COORDINATOR — Ban tổ chức cấp sự kiện

Role này có phạm vi quyền rất rộng: quản lý competition, người dùng, team, workshop, round, judging, ranking, GitHub, AI review, result và audit. Đây là role dành cho người chịu trách nhiệm toàn bộ một hoặc nhiều sự kiện.

Trách nhiệm:

- dựng cấu hình competition và lịch;
- mở/đóng đăng ký đúng giờ;
- giám sát team, mentor, check-in;
- chuẩn bị repo, round, rubric và board;
- mở nhận bài, khóa bài, điều phối chấm;
- xác minh ranking/finalist, giải quyết tie và công bố;
- theo dõi job GitHub/AI/media và báo cáo sự cố.

### 2.3 COORDINATOR — Điều phối viên

Trong cấu hình quyền hiện tại, COORDINATOR gần giống COMPETITION_COORDINATOR ở nghiệp vụ sự kiện nhưng ít quyền quản trị role hơn. Có thể hiểu đây là thành viên ban tổ chức trực tiếp vận hành.

Khuyến nghị phân công nội bộ:

- Registration coordinator: account, team, invitation, capacity.
- Program coordinator: timeline, workshop, speaker.
- Technical coordinator: GitHub, repository, webhook, AI review.
- Judging coordinator: round, rubric, board, score completeness, ranking.
- Media/check-in coordinator: QR, attendance, gallery moderation.

Hệ thống hiện chưa giới hạn mọi dữ liệu theo “coordinator được gán competition nào”, vì vậy ban tổ chức phải cấp role thận trọng.

### 2.4 JUDGE — Giám khảo

Judge có thể xem thông tin competition/track/workshop/team và tạo phiếu chấm. Judge chỉ nên:

- xem round/board được giao;
- xem submission của team thuộc board;
- nhập điểm theo từng criterion của rubric;
- thêm nhận xét;
- kiểm tra đủ điểm rồi submit để khóa phiếu.

Judge không quyết định thay đổi bài, team, rubric hoặc ranking chính thức. AI review chỉ là thông tin tham khảo, không thay điểm judge.

### 2.5 MENTOR — Cố vấn

Mentor được gán cho Team `CONFIRMED`. Mentor có thể:

- xem team được giao;
- tham gia phòng chat chung với team;
- hướng dẫn chuyên môn/quy trình;
- xem workshop, track và một số AI technical insight theo permission.

Mentor không được nộp bài hoặc chấm điểm thay team/judge. Mentor cần tránh đưa giải pháp hoàn chỉnh nếu thể lệ yêu cầu tính độc lập.

### 2.6 SPEAKER — Diễn giả

Speaker phụ trách workshop:

- xem competition/track/workshop liên quan;
- tạo Google Meet cho workshop khi được phép và có kết nối Google hợp lệ;
- xem câu hỏi, rating/feedback insight theo phạm vi;
- tổ chức nội dung đúng lịch.

Speaker không quản lý team, chấm điểm hoặc kết quả.

### 2.7 PARTICIPANT — Người tham gia

Participant có thể:

- xem competition đang mở đăng ký và competition mình đã tham gia;
- đăng ký/lập team, mời hoặc chấp nhận lời mời theo quy tắc;
- xem trạng thái team và check-in;
- xem workshop, gửi câu hỏi, vote, rating/feedback;
- chat trong team và với mentor được giao;
- upload media của competition/team mình;
- làm việc trên repository khi được cấp quyền;
- nộp submission của team trong thời gian hợp lệ;
- xem kết quả đã được công bố theo phạm vi.

Tài khoản participant cần thông tin sinh viên; sinh viên ngoài trường cần thêm trường học. Tài khoản phải `ACTIVE` mới tham gia đầy đủ.

## 3. Vòng đời tổng thể của một sự kiện

```text
Chuẩn bị tài khoản và tích hợp
        ↓
Tạo Competition (DRAFT)
        ↓
Tạo Track + Timeline + Workshop + quy định
        ↓
OPEN_REGISTRATION
        ↓
Participant lập/join team → team đủ người → CONFIRMED
        ↓
REGISTRATION_CLOSED
        ↓
Chốt mentor + repo + check-in + lịch
        ↓
ONGOING
        ↓
Round OPEN → nhận submission → khóa bài
        ↓
SCORING → Judge chấm và khóa score sheet
        ↓
Ranking → Finalist → Final round (nếu có)
        ↓
Publish result → COMPLETED
        ↓
Thu hồi quyền, lưu trữ → ARCHIVED
```

**Cảnh báo:** ngày giờ hiện không tự chuyển competition qua các trạng thái. Coordinator phải đổi trạng thái đúng thời điểm và đối chiếu checklist ở phần 16.

## 4. Trạng thái và ý nghĩa nghiệp vụ

### 4.1 Competition

| Trạng thái | Ý nghĩa | Người dùng được làm gì | Điều phối cần làm |
|---|---|---|---|
| `DRAFT` | Đang chuẩn bị, chưa công khai | Admin/coordinator cấu hình | Hoàn thiện thông tin, lịch, track, capacity, tích hợp |
| `OPEN_REGISTRATION` | Đang nhận đăng ký | Participant thấy competition và tạo/join team trong cửa sổ ngày | Theo dõi số team, lời mời, capacity |
| `REGISTRATION_CLOSED` | Ngừng nhận đăng ký | Team không tiếp tục tuyển theo luồng chuẩn | Chốt team, xử lý waitlist/rejected, phân mentor |
| `ONGOING` | Sự kiện đang diễn ra | Check-in, workshop, làm bài, media theo lịch | Theo dõi vận hành và sự cố |
| `SCORING` | Đang chấm | Judge nhập/nộp điểm; bài nên được đóng băng | Đối soát đủ phiếu, không sửa rubric |
| `COMPLETED` | Đã hoàn thành | Xem kết quả/nội dung được công bố | Thu hồi quyền theo chính sách, tổng kết |
| `ARCHIVED` | Lưu trữ | Chủ yếu chỉ đọc | Giữ dữ liệu/audit, hạn chế thao tác mới |

Luồng chuẩn là đi từ trên xuống. Mã nguồn hiện chưa chặn mọi bước nhảy; operator không được lợi dụng khả năng đó trừ xử lý sự cố có phê duyệt.

### 4.2 Team

| Trạng thái | Ý nghĩa |
|---|---|
| `WAITING_FOR_MEMBERS` | Team đã tạo nhưng chưa đủ số member được xác nhận |
| `WAITLISTED` | Đủ điều kiện cơ bản nhưng đang chờ suất/capacity hoặc duyệt |
| `CONFIRMED` | Team hợp lệ, được đi tiếp; chỉ trạng thái này được check-in và gán mentor theo rule hiện tại |
| `REJECTED` | Không được chấp nhận; không tính vào confirmed capacity |
| `CANCELLED` | Team bị hủy; không còn là team hoạt động |

Qualification phản ánh tiến trình thi, tách khỏi status đăng ký: `REGISTERED`, `PRELIMINARY`, `FINALIST`, `AWARDED`, `ELIMINATED`.

### 4.3 Participant và invitation

- Participant: `INVITED` → `JOINED` hoặc `WITHDRAWN`.
- Eligibility: `PENDING`, `ELIGIBLE`, `INELIGIBLE`.
- Check-in: `NOT_CHECKED_IN`, `CHECKED_IN`.
- GitHub access: `NOT_GRANTED`, `GRANTED`, `REVOKED`.
- Invitation: `PENDING` → `ACCEPTED`, `DECLINED`, `EXPIRED` hoặc `CANCELLED`.

Một user không nên đồng thời là active member của nhiều team trong cùng competition. Lời mời pending không đồng nghĩa với membership đã xác nhận.

### 4.4 Track, round, board và chấm điểm

- Track: `DRAFT`, `OPEN`, `LOCKED`, `COMPLETED`.
- Round: `DRAFT`, `OPEN`, `CLOSED`, `SCORING`, `COMPLETED`; loại `PRELIMINARY` hoặc `FINAL`.
- Judging board: `DRAFT`, `ASSIGNED`, `SCORING`, `COMPLETED`.
- Submission: `DRAFT`, `SUBMITTED`, `ACCEPTED`, `REJECTED`.
- Rubric: `DRAFT`, `ACTIVE`, `ARCHIVED`.
- Score sheet: `DRAFT`, `SUBMITTED`, `LOCKED` (service hiện khóa trực tiếp khi submit).

### 4.5 Workshop, timeline, media và repository

- Workshop: `SCHEDULED`, `LIVE`, `COMPLETED`, `CANCELLED`.
- Timeline: `SCHEDULED`, `ONGOING`, `COMPLETED`, `CANCELLED`.
- Media: `PENDING`, `APPROVED`, `REJECTED`.
- Repository: `PENDING`, `ACTIVE`, `ARCHIVED`, `DISCONNECTED`.
- Repository access: `UNKNOWN`, `PENDING`, `GRANTED`, `REVOKED`.
- Webhook: `NOT_CONFIGURED`, `PENDING`, `REGISTERED`, `FAILED`.

## 5. Giai đoạn 0 — Chuẩn bị hệ thống

### Admin thực hiện

1. Kiểm tra biến môi trường, MongoDB, Redis, email, URL FE/BE.
2. Chạy khởi tạo DB/role/permission nếu là môi trường mới.
3. Bảo đảm production MongoDB hỗ trợ transaction; nên dùng replica set.
4. Chạy đồng thời API và worker. Nếu chỉ chạy API, webhook và AI job có thể không hoàn tất.
5. Cấu hình storage Cloudinary hoặc Supabase; kiểm tra loại file và giới hạn dung lượng.
6. Cấu hình GitHub token/org/owner, webhook secret và n8n nếu dùng AI review.
7. Cấu hình Google OAuth cho speaker/coordinator cần tạo Meet.
8. Tạo và kích hoạt tài khoản coordinator; chỉ cấp role đủ dùng.
9. Kiểm tra audit log và email notification hoạt động.

### Điều kiện sẵn sàng

- API health tốt; MongoDB/Redis kết nối.
- Worker nhận job.
- Gửi email thử thành công.
- Upload/download media thử thành công.
- GitHub connection test thành công và webhook có secret.
- Tài khoản operator ở trạng thái `ACTIVE`.

## 6. Giai đoạn 1 — Tạo competition ở DRAFT

Coordinator tạo competition với tối thiểu:

- tên, mô tả, series/season/year;
- thời gian bắt đầu/kết thúc competition;
- thời gian mở/đóng đăng ký;
- số team tối đa;
- số thành viên tối thiểu/tối đa mỗi team;
- địa điểm hoặc hình thức online;
- thể lệ, điều kiện tham gia, chính sách repo/media/check-in;
- trạng thái ban đầu `DRAFT`.

### Quy tắc ngày giờ nên áp dụng

```text
registrationOpenAt < registrationCloseAt <= eventStartAt < eventEndAt
```

Nếu có submission/round:

```text
eventStartAt <= submissionOpenAt < submissionCloseAt <= scoringStartAt
```

### Không nên mở đăng ký khi

- chưa chốt min/max member hoặc capacity;
- chưa có điều khoản tham gia;
- chưa kiểm tra participant có thể đăng ký;
- lịch competition mâu thuẫn;
- coordinator chưa được phân công theo ca;
- chưa thống nhất cách xử lý waitlist, tie, submission muộn và GitHub access.

## 7. Giai đoạn 2 — Track, timeline và workshop

### Track

Track phân nhóm chủ đề/problem statement. Mỗi track cần code/tên, mô tả, loại, giới hạn team và trạng thái. Chỉ mở track khi nội dung đã chốt. Khi đã phân team và thi, nên khóa để tránh đổi đề.

### Timeline

Timeline là lịch hiển thị cho người dùng: mở đăng ký, workshop, check-in, khai mạc, hạn nộp, chấm và công bố. Timeline hiện có tính thông tin; không nên giả định timeline tự điều khiển competition status.

### Workshop

Mỗi workshop có competition, tiêu đề, presenter/speaker, thời gian, mô tả, trạng thái và có thể có Google Meet.

Luồng chuẩn:

1. Tạo workshop `SCHEDULED` trong thời gian competition.
2. Gán speaker hoặc nhập speakerInfo.
3. Speaker/coordinator kết nối Google và tạo Meet nếu cần.
4. Đến giờ, chuyển `LIVE`.
5. Participant gửi câu hỏi/vote trước hoặc trong buổi.
6. Sau giờ kết thúc, chuyển `COMPLETED`; participant rating/feedback.
7. Coordinator xem insight; không công khai danh tính/nguyên văn feedback nếu chính sách không cho phép.

Hệ thống hiện dựa nhiều vào permission và chưa xác minh membership competition ở mọi workshop endpoint; operator không nên chia sẻ link workshop riêng cho người ngoài competition.

## 8. Giai đoạn 3 — Mở đăng ký

### Checklist trước khi đổi `OPEN_REGISTRATION`

- Thời gian hiện tại nằm trong cửa sổ đăng ký.
- Competition vẫn đủ capacity.
- Form participant/profile đã rõ yêu cầu.
- Min/max team member đúng.
- Track có thể chọn đã mở.
- Email invitation hoạt động.
- Quy tắc sinh viên nội bộ/bên ngoài đã công bố.

### Participant đăng ký

1. Tạo tài khoản hoặc đăng nhập.
2. Hoàn thiện profile, student type, student ID; external student nhập school.
3. Chờ tài khoản `ACTIVE` nếu hệ thống yêu cầu duyệt.
4. Xem competition đang mở đăng ký.
5. Chọn một trong hai cách:
   - tạo team và trở thành leader;
   - nhận lời mời vào team có sẵn.

### Leader tạo team

1. Chọn competition/track phù hợp.
2. Nhập tên team/project/chapter theo form.
3. Mời participant bằng tài khoản/email hợp lệ.
4. Theo dõi invitation pending/accepted/declined.
5. Bảo đảm số thành viên xác nhận đạt min và không vượt max trước hạn.

Hệ thống kiểm tra trùng membership trong competition, giới hạn thành viên, trạng thái tài khoản và capacity. Team đủ số member được xác nhận có thể tự chuyển `CONFIRMED` nếu còn suất.

### Khi hết capacity hoặc hết hạn

- Confirmed team được giữ suất.
- Team chưa đủ điều kiện có thể WAITLISTED/REJECTED tùy luồng.
- Khi đóng đăng ký, hệ thống có xử lý reject team mở và cancel lời mời chưa xử lý.
- Coordinator phải đối soát số confirmed team, không lấy tổng tất cả status làm capacity.

## 9. Giai đoạn 4 — Đóng đăng ký và chốt danh sách

Coordinator đổi competition sang `REGISTRATION_CLOSED` đúng giờ và thực hiện:

1. Xuất/đối soát danh sách Team `CONFIRMED`.
2. Kiểm tra mỗi team đủ member `JOINED`/được xác nhận.
3. Xử lý trùng student ID/email/GitHub username nếu có.
4. Chốt waitlist/rejected/cancelled; không tính các team này vào confirmed capacity.
5. Khóa thay đổi thành viên hoặc quy định rõ thời hạn thay người.
6. Gán mentor chỉ cho confirmed team.
7. Chuẩn bị repository chỉ cho confirmed team theo nghiệp vụ chuẩn.
8. Chuẩn bị check-in list và kênh hỗ trợ.

### Gán mentor

- Chọn mentor `ACTIVE`.
- Chỉ chọn Team `CONFIRMED`.
- Có thể gán một hoặc nhiều mentor theo chính sách.
- Khi xóa assignment, tải lại phải không còn mentor cũ; nếu còn, kiểm tra cache/data relation.
- Mentor sau khi gán sẽ thấy team/chat tương ứng.

## 10. Giai đoạn 5 — Repository và GitHub

### Mô hình nghiệp vụ khuyến nghị

Repo chính được ban tổ chức/admin tạo hàng loạt trong GitHub organization, sau đó cấp collaborator cho member của Team `CONFIRMED`. “Link existing repository” chỉ là tính năng phụ khi repo đã tạo ngoài SEAL.

### Thiết lập cho mỗi competition

1. Bật GitHub integration.
2. Nhập organization và owner username.
3. Lưu token có đủ scope tối thiểu.
4. Test connection.
5. Cấu hình webhook secret.
6. Chọn quy ước tên repo và default branch.
7. Chọn round nếu repo gắn với vòng.

### Bulk create

1. Lọc danh sách Team `CONFIRMED` chưa có repo.
2. Chọn round hoặc No round theo thiết kế.
3. Preview tên repo; xử lý tên trùng/không hợp lệ.
4. Bulk Create Repos.
5. Đối soát từng item: success/already exists/failed.
6. Bulk Grant Access sau khi member có GitHub username.
7. Đăng ký webhook và kiểm tra trạng thái REGISTERED.

Không nên coi request bulk “thành công” là tất cả 30 repo đều thành công; phải xem kết quả từng item.

### Link existing repo

Dùng khi repo đã được tạo ngoài hệ thống. Chọn team, nhập owner, repository name, default branch rồi link. Không link một repo cho nhiều team nếu nghiệp vụ yêu cầu repo riêng.

### Trong sự kiện

- Webhook nhận push và tạo record/job.
- Worker xử lý commit; AI review có thể chạy qua n8n nếu bật.
- AI audit là bằng chứng kỹ thuật/tham khảo, không phải điểm chính thức.
- Theo dõi webhook FAILED, AI RETRY_PENDING/MANUAL_REDISPATCH_REQUIRED.

### Kết thúc

- Chọn chính sách giữ hoặc thu hồi collaborator.
- Bulk revoke theo team khác hoàn toàn “revoke all organization members except owner”. Danger Zone tác động toàn organization và chỉ ADMIN được dùng sau khi xác nhận chính xác.
- Đối soát trạng thái trên GitHub thật, không chỉ DB.

## 11. Giai đoạn 6 — Check-in

### Điều kiện nghiệp vụ

- Participant thuộc competition.
- Participant thuộc Team `CONFIRMED`.
- Competition đang ở trạng thái `ONGOING`.
- Một participant chỉ có một trạng thái check-in hợp lệ; scan lặp phải idempotent hoặc báo đã check-in.

### QR check-in

1. Coordinator mở khu check-in của competition.
2. Tạo/hiển thị QR ngắn hạn.
3. Participant đăng nhập mobile và scan.
4. Backend xác minh QR, competition, participant và confirmed team.
5. Mobile hiển thị rõ `Checked in`; sau đó ẩn hành động QR để tránh nhầm.

### Manual check-in

Dùng khi camera/mạng/tài khoản gặp sự cố. Coordinator tìm participant trong danh sách confirmed team, xác nhận danh tính rồi check-in thủ công. Nên lưu operator, thời gian và lý do.

### Rule hiện tại

Backend cho phép QR/manual check-in khi competition `ONGOING` và participant thuộc Team `CONFIRMED`. Timeline `CHECK_IN` nếu có chỉ dùng để hiển thị lịch vận hành, không phải điều kiện bắt buộc.

## 12. Giai đoạn 7 — Vận hành ongoing

Đổi competition sang `ONGOING` khi sự kiện thực sự bắt đầu. Ban tổ chức theo dõi:

- tỷ lệ check-in và trường hợp manual;
- workshop/live link và câu hỏi;
- mentor assignment/chat;
- repository/access/webhook;
- media pending;
- incident và notification;
- timeline sắp tới, đặc biệt submission deadline.

### Chat

Phòng chat chung cho leader/member và mentor của team. Team WAITING/WAITLISTED/CONFIRMED có thể có room; REJECTED/CANCELLED bị chặn. Tin nhắn hỗ trợ text/image/file về mặt type, nhưng FE/storage phải xử lý file phù hợp.

### Media

Participant đã JOINED competition có thể upload cho competition/team mình trong các status được hỗ trợ. Media mới ở `PENDING`; coordinator approve để vào gallery hoặc reject. File private dùng signed URL có thời hạn. Người upload chỉ tự xóa media pending của mình; moderator có quyền rộng hơn.

## 13. Giai đoạn 8 — Thiết lập vòng thi và rubric

### Tạo round

Mỗi round cần:

- competition;
- tên/số thứ tự và loại PRELIMINARY hoặc FINAL;
- thời gian mở/đóng submission;
- thời gian chấm;
- danh sách Team `CONFIRMED` được tham gia;
- rubric;
- cấu hình board và judge;
- số finalist/cách chọn nếu áp dụng.

Round bắt đầu ở `DRAFT`. Không mở round khi chưa có team/rubric/board.

### Tạo rubric

1. Tạo rubric DRAFT cho competition/round.
2. Thêm criterion: tên, mô tả, max score, weight, order.
3. Kiểm tra tổng điểm và cách dùng weight.
4. Chạy thử một phiếu điểm mẫu.
5. Chuyển ACTIVE trước scoring.
6. Sau khi có điểm, không sửa criterion/weight; nếu cần, tạo version mới và reset score có phê duyệt.

AI review không được tự cộng vào rubric judge trừ khi thể lệ được thiết kế và mã nguồn được thay đổi có kiểm soát.

## 14. Giai đoạn 9 — Judging board

### Chuẩn bị

- Judge phải là tài khoản `ACTIVE` có role JUDGE.
- Team phải `CONFIRMED` và nằm trong assignedTeamIds của round.
- Chốt boardCount, maxTeamsPerBoard, số judge mỗi board.
- Tránh xung đột lợi ích giữa judge/mentor/team.

### Randomize và confirm

1. Tạo preview phân team/judge.
2. Kiểm tra không team nào thiếu hoặc xuất hiện hai lần.
3. Kiểm tra mọi board không vượt capacity và tải gần cân bằng.
4. Kiểm tra judge không trùng/xung đột.
5. Điều chỉnh thủ công nếu cần.
6. Confirm assignment và chuyển board sang ASSIGNED.

Với nhiều round, phải đối chiếu placement theo từng round. Model Team hiện có trường board toàn cục nên cần đặc biệt cẩn thận; xem báo cáo lỗi BE-08.

## 15. Giai đoạn 10 — Submission

### Team thực hiện

1. Chọn đúng competition, round và team.
2. Tạo draft trong cửa sổ nhận bài.
3. Điền nội dung được yêu cầu: title/description, repository, demo URL, slide/tài liệu tùy form.
4. Kiểm tra link truy cập được bằng tài khoản ban tổ chức.
5. Submit trước deadline.
6. Sau submit, không tự ý thay đổi nếu không có cơ chế reopen.

### Coordinator thực hiện

1. Theo dõi team chưa tạo draft/chưa submit.
2. Gửi nhắc trước hạn.
3. Đóng nhận bài đúng giờ.
4. Review submission thành ACCEPTED hoặc REJECTED theo rule.
5. Trường hợp nộp muộn phải có policy và audit, không sửa trực tiếp im lặng.

### Cảnh báo bảo mật hiện tại

Ownership của submission chưa được Backend khóa đủ chặt. FE phải giới hạn đúng team, nhưng đây không phải biện pháp bảo mật hoàn chỉnh; cần sửa BE-01/02 trước production.

## 16. Giai đoạn 11 — Scoring

### Trước khi chuyển competition/round sang SCORING

- Đã khóa submission.
- Mọi bài cần chấm ở SUBMITTED/ACCEPTED.
- Rubric ACTIVE và bất biến.
- Board ASSIGNED, judge đầy đủ.
- Đã xử lý judge vắng/xung đột.
- Không còn thay đổi team/placement.

### Judge chấm

1. Mở board được giao.
2. Đọc submission và evidence.
3. Có thể xem AI technical audit như tham khảo.
4. Nhập điểm từng criterion không vượt maxScore.
5. Viết nhận xét rõ, chuyên nghiệp.
6. Kiểm tra tất cả criterion.
7. Submit; phiếu chuyển LOCKED và không sửa được.

### Coordinator đối soát

Tạo ma trận:

| Team | Judge được gán | Phiếu đã khóa | Đủ? |
|---|---:|---:|---|
| Team A | 3 | 3 | Có |
| Team B | 3 | 2 | Không |

Chỉ generate ranking khi tất cả team đủ phiếu hoặc đã có quyết định chính thức về judge vắng. Backend hiện chưa cưỡng chế đầy đủ việc này.

## 17. Giai đoạn 12 — Ranking, tie-break và finalist

### Ranking

Ranking chính thức hiện hỗ trợ tốt nhất ở cấp TEAM. Điểm lấy từ judge score sheet đã submit/locked; AI không tác động điểm.

Quy trình:

1. Đối soát đủ phiếu.
2. Generate ranking nháp.
3. Kiểm tra total/average/weight và thứ tự.
4. Kiểm tra team thiếu điểm hoặc điểm bất thường.
5. Xử lý đồng điểm.
6. Chọn finalist theo mode.
7. Review lần cuối rồi publish.

### Tie-break

Nếu đồng điểm ở vị trí ảnh hưởng giải/finalist:

1. Không publish ngay.
2. Áp dụng rule đã công bố: penalty evaluation, mini test hoặc tiêu chí ưu tiên.
3. Lưu điểm phụ/chứng cứ/quyết định và người phê duyệt.
4. Cho đội biết rule được dùng.

Code hiện mới có enum/ghi chú tie, chưa xử lý tie-break hoàn chỉnh; không được để thứ tự dữ liệu tự quyết định người thắng.

### Chọn finalist

- Top overall: lấy top toàn competition/round.
- Fixed per board: lấy số cố định mỗi board; phải bảo đảm tổng khớp finalistCount.
- Custom/manual: coordinator chọn có lý do.

FinalistCount là ràng buộc cần đối soát trước publish. Team được chọn chuyển qualification `FINALIST`; đội khác có thể `ELIMINATED` theo quy định.

### Final round

Nếu có vòng FINAL, lặp lại: tạo/kiểm tra round → placement → submission hoặc presentation → scoring → ranking. Không tái dùng placement vòng preliminary nếu dữ liệu không round-scoped.

## 18. Giai đoạn 13 — Công bố và kết thúc

### Trước publish

- Kết quả đã được ban tổ chức phê duyệt.
- Không thiếu score sheet.
- Tie đã giải quyết.
- Finalist/winner đúng số lượng.
- Nội dung công bố không lộ nhận xét nội bộ.
- Kế hoạch thu hồi GitHub đã rõ.

### Sau publish

1. Publish result.
2. Kiểm tra participant chỉ thấy dữ liệu được phép.
3. Chuyển final round COMPLETED.
4. Chuyển competition COMPLETED thủ công nếu hệ thống chưa tự làm.
5. Gửi notification/email.
6. Chuyển winner `AWARDED`, đội còn lại theo qualification policy.
7. Thu hồi/quy trì GitHub access.
8. Hoàn tất media moderation và báo cáo.
9. Archive competition sau thời gian khiếu nại/đối soát.

## 19. Ma trận chức năng theo role

| Nhóm chức năng | Admin | Competition Coordinator | Coordinator | Judge | Mentor | Speaker | Participant |
|---|---|---|---|---|---|---|---|
| Quản trị role/permission | Toàn quyền | Rất rộng theo cấu hình hiện tại | Chủ yếu xem | Không | Không | Không | Không |
| Competition/track/timeline | Toàn quyền | Quản lý | Quản lý | Xem | Xem | Xem | Xem theo phạm vi |
| Team/participant/check-in | Toàn quyền | Quản lý | Quản lý | Xem hạn chế | Team được giao | Xem hạn chế | Team của mình |
| Mentor assignment | Có | Có | Có | Không | Nhận assignment | Không | Xem mentor |
| Workshop | Quản lý | Quản lý | Quản lý | Xem | Xem | Trình bày/Meet/insight | Xem và tương tác |
| Chat | Theo policy/team | Khi là participant phòng | Khi là participant phòng | Không mặc định | Team được giao | Không mặc định | Team của mình |
| Media | Cấu hình/moderate | Moderate | Moderate | Xem theo scope | Xem theo scope | Xem theo scope | Upload competition/team mình |
| GitHub/repo | Toàn quyền | Quản lý | Quản lý | Xem evidence | Xem audit | Không mặc định | Collaborator team mình |
| Round/rubric/board | Toàn quyền | Quản lý | Quản lý | Board được giao | Xem hạn chế | Không | Xem thông tin công khai |
| Submission | Quản lý/review | Quản lý/review | Quản lý/review | Đọc team được chấm | Đọc team được giao | Không | Tạo/nộp team mình |
| Score | Quản lý/đối soát | Quản lý/đối soát | Quản lý/đối soát | Tạo/khóa phiếu mình | Không | Không | Chỉ kết quả công bố |
| Ranking/result | Quản lý/publish | Quản lý/publish | Quản lý/publish | Xem theo policy | Xem theo policy | Xem công bố | Xem công bố |
| Audit/operations | Toàn quyền | Có theo permission | Có theo permission | Không | Không | Không | Không |

Ma trận trên mô tả nghiệp vụ mong muốn. Một số endpoint hiện rộng hơn; các chênh lệch được ghi trong báo cáo lỗi.

## 20. Business rules cốt lõi

1. DRAFT chỉ dành cho admin/coordinator; participant không được biết competition draft.
2. Participant thấy competition đã tham gia và competition đang mở đăng ký theo policy sản phẩm.
3. Một participant chỉ thuộc một team hoạt động trong cùng competition.
4. Team chỉ CONFIRMED khi đủ số member được xác nhận và competition còn capacity.
5. REJECTED/CANCELLED không được tính vào confirmed capacity.
6. Chỉ Team CONFIRMED được gán mentor, check-in, vào round chính thức và cấp repo theo nghiệp vụ chuẩn.
7. Chỉ member team được tạo/sửa/nộp submission của team đó.
8. Chỉ judge ACTIVE được gán board và chấm team thuộc board.
9. Score sheet đã submit/locked là bất biến.
10. Rubric đã dùng chấm không được sửa; thay đổi phải version hóa.
11. AI review chỉ là tham khảo, không tự tạo điểm official.
12. Ranking chỉ được công bố khi đủ phiếu, giải quyết tie và được phê duyệt.
13. Media pending không xuất hiện trong gallery công khai.
14. GitHub revoke phải được xác minh trên GitHub, không chỉ đổi trạng thái DB.
15. Mọi override quan trọng phải có actor, reason, timestamp và audit log.

## 21. Giới hạn hiện tại cần người vận hành biết

- Competition không tự đổi trạng thái theo ngày.
- Check-in dùng trạng thái competition `ONGOING`; timeline check-in chỉ mang tính lịch hiển thị.
- Submission ownership và data scope còn cần siết ở BE.
- Tài nguyên con như workshop/track/timeline chưa dùng chung competition visibility ở mọi nơi.
- Placement board trên Team chưa round-scoped hoàn chỉnh.
- Ranking CHAPTER/INDIVIDUAL chưa phải luồng official đầy đủ.
- Tie-break chưa được tự động thực thi.
- Ranking chưa chặn tuyệt đối khi thiếu phiếu judge.
- Repo không tự sinh chắc chắn ngay khi team confirmed; bulk operation là bước vận hành.
- GitHub/n8n cần worker + Redis; tích hợp ngoài có thể thành công một phần.
- Transaction an toàn yêu cầu MongoDB deployment phù hợp.
- Hard delete có thể ảnh hưởng dữ liệu liên quan; ưu tiên archive.

## 22. Checklist điều hành theo mốc thời gian

### T-30 đến T-14 ngày

- [ ] Hạ tầng, role, email, storage, GitHub, Google, Redis/worker sẵn sàng.
- [ ] Competition DRAFT hoàn chỉnh.
- [ ] Track, thể lệ, min/max team, capacity được duyệt.
- [ ] Timeline/workshop sơ bộ.
- [ ] Chính sách scoring, tie, repo, media, check-in được công bố.

### T-14 ngày — Mở đăng ký

- [ ] Đổi competition sang OPEN_REGISTRATION.
- [ ] Kiểm tra participant nhìn thấy đúng competition.
- [ ] Test tạo team, mời, accept, auto-confirm.
- [ ] Theo dõi capacity và email lỗi mỗi ngày.

### T-1 đến T-3 ngày — Đóng đăng ký

- [ ] Đổi REGISTRATION_CLOSED đúng giờ.
- [ ] Chốt confirmed team/member.
- [ ] Gán mentor.
- [ ] Bulk create/grant repo và đối soát.
- [ ] Chốt workshop, check-in list, support roster.
- [ ] Tạo round/rubric/board ở DRAFT.

### Ngày sự kiện

- [ ] Đổi ONGOING.
- [ ] Chỉ mở QR đúng cửa sổ.
- [ ] Theo dõi check-in/manual exceptions.
- [ ] Theo dõi workshop, chat, media, webhook/AI jobs.
- [ ] Nhắc deadline submission.

### Trước scoring

- [ ] Khóa submission.
- [ ] Review bài hợp lệ.
- [ ] Rubric ACTIVE, board ASSIGNED, judge ACTIVE.
- [ ] Đổi round/competition sang SCORING theo quy trình.

### Trước publish

- [ ] Đủ score sheet cho mọi team/judge.
- [ ] Điểm bất thường đã kiểm tra.
- [ ] Tie đã xử lý.
- [ ] Finalist/winner đã phê duyệt.
- [ ] Preview quyền xem kết quả bằng tài khoản participant.

### Sau sự kiện

- [ ] Publish result, đổi COMPLETED.
- [ ] Gửi thông báo.
- [ ] Thu hồi/giữ GitHub đúng chính sách và đối soát thật.
- [ ] Xử lý media/feedback/report.
- [ ] Backup, audit và archive sau thời hạn khiếu nại.

## 23. Xử lý sự cố thường gặp

### Participant không thấy competition

Kiểm tra competition có DRAFT không, đã OPEN_REGISTRATION chưa, ngày đăng ký, participant đã tham gia competition chưa và account có ACTIVE không.

### Team không CONFIRMED

Kiểm tra số member accepted/joined, min/max, capacity competition, lời mời pending và participant có đang ở team khác không.

### Không check-in được

Kiểm tra đúng competition, QR còn hạn, participant thuộc Team CONFIRMED, đã đăng nhập đúng tài khoản và chưa check-in. Nếu cần manual, xác minh danh tính trước.

### Mentor không thấy team/chat

Kiểm tra team CONFIRMED, assignment còn tồn tại, mentor ID đúng, account ACTIVE và client đã refresh dữ liệu/socket.

### Repo không tạo/cấp quyền được

Kiểm tra GitHub config, token scope, org, tên repo, GitHub username của member, rate limit và kết quả từng item của bulk job.

### Push có nhưng AI review không chạy

Kiểm tra webhook signature/status, Redis, worker, queue failed jobs, n8n enabled/URL/token/callback. Redispatch chỉ áp dụng cho trạng thái cho phép.

### Judge không chấm được

Kiểm tra role/permission, judge có trong board, team có trong board, submission đúng context, round có rubric và score không vượt max.

### Ranking sai hoặc thiếu team

Kiểm tra assigned teams, accepted submissions, score sheet LOCKED, đủ judge, placement đúng round, filter và tie.

## 24. Quy tắc an toàn cho Admin/Coordinator

- Không chia sẻ `.env`, GitHub token, Google token, storage service-role key hoặc webhook secret.
- Không dùng Danger Zone trên organization khi chưa có backup/danh sách member và xác nhận hai người.
- Không hard delete competition đã có team/submission/score.
- Không sửa trực tiếp MongoDB để “chữa nhanh” nếu chưa hiểu quan hệ; ưu tiên API/operation có audit.
- Không công bố ranking khi còn job/phiếu thiếu.
- Không tin riêng trạng thái DB cho thao tác tích hợp ngoài; đối soát GitHub/Google/storage thật.
- Dùng tài khoản role thấp để test khả năng nhìn thấy dữ liệu trước khi mở competition/publish.

## 25. Tiêu chí một sự kiện được xem là vận hành thành công

- Không participant nào thấy competition/tài nguyên riêng ngoài phạm vi.
- 100% team chính thức là CONFIRMED và membership rõ ràng.
- Check-in có thể truy vết người, thời gian, phương thức.
- Mỗi confirmed team có repo/access đúng chính sách.
- Submission được khóa đúng hạn và không bị team khác chỉnh sửa.
- Mỗi team có đủ phiếu từ judge được giao.
- Tie/finalist/winner có bằng chứng và phê duyệt.
- Kết quả công bố đúng quyền xem.
- GitHub/media/job lỗi được đối soát, không có trạng thái “thành công giả”.
- Audit log và backup đủ để điều tra/kế thừa sự kiện sau.

## 26. Kết luận

SEAL Hackathon đã bao phủ gần trọn chu trình một hackathon, nhưng chất lượng vận hành phụ thuộc vào việc coordinator dùng đúng thứ tự trạng thái và thực hiện các bước đối soát. Cho tới khi các vấn đề P0/P1 trong báo cáo kỹ thuật được sửa, ban tổ chức cần coi checklist trong tài liệu này là bắt buộc, đặc biệt ở submission ownership, score visibility, competition ONGOING cho check-in, đủ phiếu judge, tie-break và đồng bộ GitHub.

# Báo cáo rà soát lỗi logic và nghiệp vụ Backend

> Ngày rà soát: 12/07/2026  
> Phạm vi: toàn bộ mã nguồn `src/modules`, model, middleware, route, worker và các bài kiểm thử hiện có.  
> Mục đích: ghi nhận rủi ro còn tồn tại để đội dự án xác minh và xử lý. Đây là báo cáo kiểm tra tĩnh theo mã nguồn, không thay thế kiểm thử tích hợp với MongoDB, Redis, GitHub, Google, n8n và dịch vụ lưu trữ thật.

## 1. Cách đọc mức độ ưu tiên

- **P0 – Khẩn cấp:** có thể làm sai dữ liệu, vượt quyền hoặc làm kết quả cuộc thi không đáng tin cậy. Nên sửa trước khi vận hành thật.
- **P1 – Cao:** ảnh hưởng trực tiếp tới quy trình sự kiện hoặc tạo trạng thái không nhất quán.
- **P2 – Trung bình:** có cách vận hành né tránh nhưng dễ gây nhầm lẫn hoặc tăng thao tác thủ công.
- **P3 – Thấp:** giới hạn kỹ thuật, trải nghiệm hoặc khả năng bảo trì.
- **Nghi vấn:** cần kiểm thử nghiệp vụ/thống nhất quyết định với Product Owner trước khi kết luận là lỗi.

## 2. Tóm tắt điều hành

Các luồng team, lời mời, giới hạn thành viên, check-in của team `CONFIRMED`, chat theo thành viên team và ẩn competition `DRAFT` đã có nhiều kiểm tra tốt. Tuy nhiên hệ thống **chưa nên được xem là đã khóa chặt toàn bộ nghiệp vụ** vì còn các điểm quan trọng sau:

1. Submission chưa kiểm tra người thao tác có thuộc team hay không; quyền `TEAM_VIEW` đang đủ để tạo, sửa và nộp bài cho team bất kỳ nếu biết ID.
2. Danh sách submission và score sheet chưa giới hạn dữ liệu theo người dùng; participant có `SCORE_VIEW` nên có khả năng xem phiếu điểm của đội khác.
3. Competition, round, workshop và một số tài nguyên cho đổi trạng thái tự do, chưa có state machine.
4. Ngày giờ competition không tự đổi trạng thái; ban tổ chức phải thao tác thủ công nhưng UI/tài liệu có thể khiến người dùng kỳ vọng tự động.
5. QR/manual check-in được giới hạn theo trạng thái competition `ONGOING`; timeline check-in chỉ là lịch hiển thị.
6. Cấu hình nhiều vòng có nguy cơ ghi đè `boardNumber`/`placementSlot` trên Team vì hai trường này không gắn với round.
7. Xếp hạng chưa thực hiện tie-break thật và có thể tính khi chưa đủ phiếu của tất cả judge.

## 3. Các vấn đề cần xử lý

### BE-01 — Vượt quyền tạo, sửa và nộp submission của team khác

- **Mức độ:** P0.
- **Hiện trạng:** route tạo/sửa/nộp submission chỉ yêu cầu `TEAM_VIEW`. Controller không truyền `req.user` vào service; service không kiểm tra actor là leader/member của `teamId`.
- **Hậu quả:** participant, mentor, judge, speaker hoặc role khác có `TEAM_VIEW` có thể tác động bài của team bất kỳ nếu lấy được ID.
- **Đề xuất:** truyền actor vào toàn bộ lệnh ghi; chỉ leader hoặc thành viên `JOINED` của chính team được tạo/sửa/nộp. Coordinator chỉ được review trạng thái qua endpoint riêng. Ghi audit log actor cho mọi thay đổi.
- **Kiểm thử bắt buộc:** thành viên đội A không thể ghi bài đội B; mentor/judge không thể nộp thay; coordinator chỉ review; admin override phải được định nghĩa rõ.

### BE-02 — Lộ submission giữa các đội

- **Mức độ:** P0.
- **Hiện trạng:** list/get submission yêu cầu `COMPETITION_VIEW` nhưng service không lọc theo actor.
- **Hậu quả:** người tham gia có thể xem bài, URL demo/repository hoặc nội dung của đội khác trước hạn.
- **Đề xuất:** participant chỉ xem submission của team mình; judge chỉ xem team thuộc board được phân công và chỉ khi vòng cho phép chấm; mentor chỉ xem team được giao; coordinator/admin xem toàn bộ.

### BE-03 — Participant có thể xem score sheet không thuộc phạm vi

- **Mức độ:** P0.
- **Hiện trạng:** role PARTICIPANT có `SCORE_VIEW`; list/get score sheet chỉ kiểm tra permission, không lọc theo actor, competition, team hoặc trạng thái công bố.
- **Hậu quả:** lộ điểm từng judge, nhận xét và kết quả chưa công bố; có thể ảnh hưởng tính công bằng.
- **Đề xuất:** không cấp `SCORE_VIEW` thô cho participant hoặc thêm policy ở service. Participant chỉ xem kết quả đã publish của chính team; judge chỉ xem phiếu do mình tạo/board của mình; mentor chỉ xem theo quy định sau công bố.

### BE-04 — Chưa có workflow chuyển trạng thái competition

- **Mức độ:** P1.
- **Hiện trạng:** competition có các trạng thái `DRAFT → OPEN_REGISTRATION → REGISTRATION_CLOSED → ONGOING → SCORING → COMPLETED → ARCHIVED`, nhưng API có thể đặt trạng thái tùy ý, kể cả tạo competition trực tiếp ở trạng thái cuối.
- **Hậu quả:** competition có thể nhảy từ DRAFT sang COMPLETED, mở lại sau ARCHIVED hoặc SCORING khi chưa có round/rubric/submission.
- **Đề xuất:** triển khai state machine, điều kiện trước khi chuyển và endpoint hành động rõ nghĩa (`open-registration`, `close-registration`, `start`, `start-scoring`, `complete`, `archive`). Chỉ ADMIN mới được khôi phục ngoại lệ và phải audit.

### BE-05 — Ngày giờ không tự mở/đóng/chuyển competition

- **Mức độ:** P1 hoặc quyết định sản phẩm.
- **Hiện trạng:** ngày đăng ký được dùng để xác thực khi tạo/join team, nhưng không có scheduler tự đổi trạng thái competition. Competition vẫn DRAFT sau giờ mở nếu coordinator không thao tác.
- **Hậu quả:** dữ liệu ngày và nhãn trạng thái mâu thuẫn; người dùng không đăng ký được dù đã đến giờ, hoặc competition vẫn OPEN_REGISTRATION sau hạn ở một số màn hình.
- **Đề xuất:** chọn một trong hai phương án và công bố rõ:
  1. Tự động: worker chuyển trạng thái theo thời gian, idempotent, có cảnh báo trước và audit.
  2. Thủ công có kiểm soát: dashboard hiển thị việc cần làm, cảnh báo quá hạn và nút xác nhận.
- **Lưu ý:** tài liệu vận hành hiện tại giả định phương án 2 vì đó là hành vi mã nguồn hiện có.

### BE-06 — Check-in được quyết định theo trạng thái ONGOING

- **Mức độ:** P1.
- **Hướng xử lý đã chọn:** không dùng timeline `CHECK_IN` làm điều kiện bắt buộc. QR, scan QR và manual check-in được phép khi competition đang `ONGOING` và participant thuộc team `CONFIRMED`.
- **Hành vi hiện tại:** coordinator có thể phát QR khi competition `ONGOING`; participant trong team `CONFIRMED` có thể scan cùng QR nhiều người; manual check-in cũng dùng rule `ONGOING`. Competition `DRAFT`, `OPEN_REGISTRATION`, `REGISTRATION_CLOSED`, `SCORING`, `COMPLETED`, `ARCHIVED` bị chặn.
- **Override:** admin có thể check-in ngoài `ONGOING` nếu truyền `overrideReason`; hệ thống ghi audit log `CHECK_IN_WINDOW_OVERRIDE`.
- **Ghi chú:** timeline `CHECK_IN` nếu có chỉ phục vụ lịch/hiển thị vận hành, không khóa nghiệp vụ check-in.

### BE-07 — Đường tạo participant trực tiếp bỏ qua nghiệp vụ đăng ký

- **Mức độ:** P1.
- **Hiện trạng:** `createParticipant` kiểm tra tồn tại và trùng lặp nhưng chưa buộc competition đang mở đăng ký, tài khoản ACTIVE/PARTICIPANT, team hợp lệ hoặc điều kiện eligibility.
- **Hậu quả:** endpoint thay thế có thể đưa người dùng vào competition đã đóng/draft, khác với luồng team invitation chặt chẽ.
- **Đề xuất:** gom mọi cách gia nhập về một domain policy dùng chung; endpoint quản trị phải là override riêng, yêu cầu permission cao, reason và audit.

### BE-08 — Team placement không hỗ trợ đúng nhiều round

- **Mức độ:** P1.
- **Hiện trạng:** `boardNumber` và `placementSlot` nằm trực tiếp trên Team. Khi confirm board của round sau, dữ liệu round trước có thể bị ghi đè.
- **Hậu quả:** xem lại vòng sơ loại thấy sai board; xếp hạng chế độ theo board có thể dùng placement của vòng khác.
- **Đề xuất:** tạo collection `RoundTeamPlacement {competitionId, roundId, teamId, boardId, boardNumber, slot}`; ranking luôn đọc placement theo round. Giữ trường Team cũ chỉ để tương thích tạm thời.

### BE-09 — Kế hoạch chia judging board chưa được kiểm tra đầy đủ

- **Mức độ:** P1.
- **Hiện trạng:** lúc confirm chỉ kiểm tra mỗi team hợp lệ xuất hiện đúng một lần; chưa bắt buộc đúng `boardCount`, board number duy nhất và số team/board không vượt `maxTeamsPerBoard`.
- **Hậu quả:** có thể xác nhận một board quá tải, thiếu board hoặc trùng số board.
- **Đề xuất:** validate toàn bộ invariant trước transaction; khóa cấu hình sau confirm hoặc buộc reset có cảnh báo.

### BE-10 — Thuật toán phân team vào board không cân bằng

- **Mức độ:** P2.
- **Hiện trạng:** chia theo lát liên tiếp tối đa `maxTeamsPerBoard`; ví dụ 30 team, 3 board, max 20 có thể thành 20/10/0 thay vì 10/10/10.
- **Hậu quả:** tải chấm không đều, một board không có team.
- **Đề xuất:** shuffle có seed rồi round-robin hoặc tính `ceil(teamCount / boardCount)`; bảo đảm chênh lệch tối đa 1 và vẫn không vượt capacity.

### BE-11 — Người được gán làm judge chưa được xác minh role/trạng thái

- **Mức độ:** P1.
- **Hiện trạng:** round/board chỉ kiểm tra User tồn tại, không buộc `ACTIVE` và có role JUDGE.
- **Hậu quả:** participant hoặc tài khoản suspended có thể nằm trong hội đồng; tới lúc chấm mới lỗi quyền hoặc sai nghiệp vụ.
- **Đề xuất:** policy `isActiveJudge`; kiểm tra khi cấu hình và kiểm tra lại khi mở scoring.

### BE-12 — Score sheet thiếu điều kiện thời điểm và trạng thái

- **Mức độ:** P1.
- **Hiện trạng:** service xác minh judge thuộc board và team thuộc board nhưng chưa khóa theo `round.status`, `board.status`, trạng thái submission và trạng thái tài khoản judge. Cũng chưa bắt buộc đủ tất cả criterion khi submit; chỉ cần ít nhất một score.
- **Hậu quả:** chấm trước khi vòng mở, chấm bài draft/rejected, hoặc nộp phiếu thiếu tiêu chí.
- **Đề xuất:** chỉ tạo/sửa khi round/board ở SCORING theo workflow đã thống nhất; submission phải SUBMITTED/ACCEPTED; khi submit phải có đúng một điểm cho mỗi criterion và judge ACTIVE.

### BE-13 — Submission có thể không thuộc danh sách team của round

- **Mức độ:** P1.
- **Hiện trạng:** nếu `round.assignedTeamIds` rỗng, kiểm tra membership bị bỏ qua và mọi team trong competition có thể nộp.
- **Hậu quả:** vòng chưa cấu hình team vẫn nhận bài.
- **Đề xuất:** rỗng phải hiểu là “chưa có team”, không phải “tất cả team”, trừ khi thêm cờ explicit `includeAllConfirmedTeams`.

### BE-14 — Cửa sổ submission chưa nhất quán

- **Mức độ:** P1.
- **Hiện trạng:** có thể tạo draft khi round DRAFT; update draft không kiểm tra deadline; submit được cả khi round SCORING.
- **Hậu quả:** sửa bài sau hạn hoặc trong lúc judge đang chấm.
- **Đề xuất:** định nghĩa `submissionOpenAt/submissionCloseAt`; mọi create/update/submit dùng cùng policy. Sau deadline chỉ coordinator override có lý do. Khi bắt đầu SCORING phải đóng băng bài.

### BE-15 — Ranking có thể được tính khi chưa đủ judge

- **Mức độ:** P1.
- **Hiện trạng:** điểm được trung bình trên các score sheet đã nộp hiện có; chưa bắt buộc đủ phiếu từ toàn bộ judge được gán cho board/team.
- **Hậu quả:** team có một phiếu được xếp cùng team có nhiều phiếu; kết quả thay đổi khi phiếu muộn xuất hiện.
- **Đề xuất:** kiểm tra completeness matrix team × assigned judges; chỉ generate official ranking khi đủ 100%, hoặc coordinator xác nhận judge vắng và mẫu số mới.

### BE-16 — Tie-break mới chỉ ghi chú, chưa giải quyết đồng điểm

- **Mức độ:** P1.
- **Hiện trạng:** model có `PENALTY_EVALUATION`/`MINI_TEST`, nhưng tính ranking vẫn sắp tuần tự và `tieBreakMethod` thực tế là NONE.
- **Hậu quả:** đồng điểm ở ranh giới finalist có thể chọn tùy thứ tự dữ liệu.
- **Đề xuất:** giữ cùng hạng cho cùng điểm; chặn publish/select ở cutoff nếu chưa xử lý tie; lưu quyết định, điểm phụ, người phê duyệt và audit.

### BE-17 — Chọn finalist chưa khóa chặt số lượng

- **Mức độ:** P1/Nghi vấn.
- **Hiện trạng:** chế độ fixed-per-board và chọn thủ công có thể tạo số finalist khác `finalistCount`; chế độ CUSTOM vẫn có bước chọn top N tự động trước khi chỉnh tay.
- **Hậu quả:** cấu hình nói 10 nhưng danh sách công bố không đúng 10.
- **Đề xuất:** xác nhận ý nghĩa từng mode; validate tổng số trước publish, ngoại lệ phải có reason. CUSTOM không nên tự quyết định nếu chưa xác nhận.

### BE-18 — Publish result không đồng bộ lifecycle competition

- **Mức độ:** P2.
- **Hiện trạng:** publish kết quả hoàn tất round nhưng không tự chuyển competition sang COMPLETED.
- **Hậu quả:** kết quả đã công bố nhưng competition vẫn SCORING/ONGOING.
- **Đề xuất:** nếu đây là final round cuối, đề nghị chuyển competition COMPLETED trong cùng transaction hoặc tạo checklist bắt buộc.

### BE-19 — Thu hồi GitHub có thể làm DB lệch với GitHub

- **Mức độ:** P1.
- **Hiện trạng:** luồng publish/thu hồi có nơi cập nhật repository thành REVOKED/ARCHIVED trước; lỗi gọi GitHub chỉ được ghi log và request vẫn thành công.
- **Hậu quả:** giao diện báo đã thu hồi nhưng collaborator vẫn truy cập repo.
- **Đề xuất:** dùng outbox/job retry; lưu trạng thái `REVOKE_PENDING/REVOKE_FAILED`; chỉ GRANTED→REVOKED khi GitHub xác nhận. Dashboard phải hiển thị lỗi cần xử lý.

### BE-20 — Tự động tạo repo khi team confirmed chưa được nối hoàn chỉnh

- **Mức độ:** P2.
- **Hiện trạng:** service team còn TODO cho provisioning sau confirm/placement. Tính năng hiện dùng bulk create hoặc link repo thủ công.
- **Hậu quả:** operator có thể tưởng repo tự sinh khi team đủ người; team bị thiếu repo.
- **Đề xuất:** hoặc triển khai job idempotent sau CONFIRMED, hoặc ghi rõ bulk provisioning là bước bắt buộc và có màn hình đối soát “confirmed team chưa có repo”.

### BE-21 — Trạng thái repository cho phép team chưa confirmed

- **Mức độ:** P2/Nghi vấn.
- **Hiện trạng:** GitHub coi WAITING_FOR_MEMBERS, WAITLISTED và CONFIRMED là active trong một số thao tác.
- **Hậu quả:** có thể tạo/cấp repo cho team chưa được duyệt, trái với nghiệp vụ “chỉ team confirmed mới đi tiếp”.
- **Đề xuất:** bulk create/grant mặc định chỉ CONFIRMED; link thủ công cho trạng thái khác phải là admin override có cảnh báo.

### BE-22 — Workshop không lọc theo quyền tham gia competition

- **Mức độ:** P1.
- **Hiện trạng:** list/get workshop dựa trên `WORKSHOP_VIEW`, không dùng chính sách competition visibility/participation. Participant có permission này.
- **Hậu quả:** participant có thể xem workshop của competition không tham gia hoặc competition không nên hiển thị, dù danh sách competition chính đã lọc.
- **Đề xuất:** mọi tài nguyên con phải gọi chung `assertCanViewEvent(actor,competitionId)`; participant chỉ xem competition đã tham gia hoặc đang mở đăng ký theo quyết định nghiệp vụ.

### BE-23 — Track, timeline và một số tài nguyên con có cùng nguy cơ lộ competition

- **Mức độ:** P1.
- **Hiện trạng:** service track/timeline lọc theo query nhưng không nhận actor và không áp dụng competition visibility policy.
- **Hậu quả:** biết competitionId hoặc gọi list không filter có thể thấy dữ liệu competition khác, kể cả DRAFT.
- **Đề xuất:** policy xuyên suốt cho competition children: tracks, timelines, workshops, rounds, submissions, media, repositories, rankings.

### BE-24 — Workshop interaction không xác minh người dùng thuộc competition

- **Mức độ:** P1.
- **Hiện trạng:** tạo câu hỏi/rating/feedback kiểm tra thời gian workshop và permission nhưng không kiểm tra participant đã JOINED competition. Vote question còn không kiểm tra workshop đang nhận câu hỏi.
- **Hậu quả:** participant ngoài competition vẫn tương tác; có thể vote sau khi workshop kết thúc.
- **Đề xuất:** yêu cầu active participant của competition; vote dùng cùng time policy với create question; speaker/coordinator có ngoại lệ đọc insight.

### BE-25 — Workshop/tracks/timelines đổi trạng thái tự do và thiếu ràng buộc thời gian competition

- **Mức độ:** P2.
- **Hiện trạng:** workshop chỉ kiểm tra status thuộc enum; track/timeline tương tự; không có transition graph và không buộc lịch nằm trong competition.
- **Hậu quả:** workshop COMPLETED trước SCHEDULED, lịch ngoài thời gian competition, timeline chồng chéo hoặc orphan logic.
- **Đề xuất:** state machine nhỏ; validate start/end trong competition; cảnh báo overlap; đồng bộ timeline-workshop nếu liên kết.

### BE-26 — Regex tìm kiếm chưa escape

- **Mức độ:** P2.
- **Hiện trạng:** một số service tạo `new RegExp(query.search, 'i')` trực tiếp, đáng chú ý workshop và judging board.
- **Hậu quả:** chuỗi regex sai có thể gây lỗi 500; mẫu phức tạp có thể làm truy vấn chậm.
- **Đề xuất:** escape regex metacharacters, giới hạn độ dài, ưu tiên text index.

### BE-27 — Xóa cứng tài nguyên có thể để dữ liệu mồ côi

- **Mức độ:** P1.
- **Hiện trạng:** competition, round, board, track và một số tài nguyên có delete trực tiếp, chưa thấy kiểm tra dependency/cascade nhất quán.
- **Hậu quả:** submission/score/ranking/repository trỏ tới bản ghi đã xóa; audit khó truy vết.
- **Đề xuất:** không cho xóa sau khi đã phát sinh nghiệp vụ; dùng ARCHIVED/soft delete. Nếu DRAFT chưa dùng thì cascade trong transaction và ghi audit.

### BE-28 — Transaction có thể bị hạ xuống chế độ không transaction

- **Mức độ:** P1 vận hành.
- **Hiện trạng:** một số luồng team thử transaction rồi fallback khi MongoDB standalone.
- **Hậu quả:** lỗi giữa chuỗi cập nhật team–participant–invite–competition có thể để dữ liệu nửa chừng.
- **Đề xuất:** production bắt buộc MongoDB replica set; health check fail-fast nếu transaction không sẵn sàng. Không fallback im lặng cho thao tác quan trọng.

### BE-29 — Rubric có thể bị sửa sau khi đã dùng chấm

- **Mức độ:** P1/Nghi vấn.
- **Hiện trạng:** cần policy rõ hơn để ngăn sửa/xóa criterion khi đã có score sheet; trạng thái DRAFT/ACTIVE/ARCHIVED chưa tạo khóa bất biến đầy đủ ở mọi thao tác.
- **Hậu quả:** điểm cũ không còn khớp tiêu chí/weight mới.
- **Đề xuất:** snapshot rubric vào round khi mở scoring hoặc khóa ACTIVE rubric ngay khi có score; muốn đổi phải tạo version mới.

### BE-30 — Chưa tự động đóng chat khi kết thúc competition

- **Mức độ:** P3/Nghi vấn.
- **Hiện trạng:** chat hoạt động theo trạng thái team WAITING/WAITLISTED/CONFIRMED, không theo lifecycle competition. Team CONFIRMED của competition archived vẫn có thể chat.
- **Hậu quả:** phòng chat tồn tại lâu hơn chính sách mong muốn.
- **Đề xuất:** quyết định retention. Nếu chỉ dùng trong sự kiện, chuyển room read-only sau COMPLETED và archive sau N ngày; nếu dùng làm alumni channel thì ghi rõ.

### BE-31 — Loại ranking CHAPTER/INDIVIDUAL mới là khung dữ liệu

- **Mức độ:** P2/giới hạn tính năng.
- **Hiện trạng:** model/config có TEAM, CHAPTER, INDIVIDUAL nhưng luồng official generation chỉ hỗ trợ TEAM.
- **Hậu quả:** UI hoặc tài liệu có thể hứa tính năng chưa hoàn chỉnh.
- **Đề xuất:** ẩn lựa chọn chưa hỗ trợ hoặc triển khai công thức và kiểm thử riêng.

### BE-32 — Worker và tích hợp ngoài là điều kiện bắt buộc nhưng dễ bị bỏ sót

- **Mức độ:** P1 vận hành.
- **Hiện trạng:** webhook/AI review dùng queue, Redis, worker, GitHub secret và n8n. Chạy riêng API không hoàn tất pipeline.
- **Hậu quả:** push nhận nhưng không xử lý, AI audit đứng PENDING/RETRY, UI trông như lỗi ngẫu nhiên.
- **Đề xuất:** deployment luôn chạy API + worker + Redis; health dashboard kiểm tra queue lag, failed jobs, webhook signature/config và n8n callback.

## 4. Những kiểm soát đã có và nên giữ

- Competition DRAFT đã được ẩn với role ngoài ADMIN/COORDINATOR theo policy competition hiện tại.
- Participant chỉ thấy competition đã tham gia hoặc đang mở đăng ký ở luồng competition chính.
- Check-in QR/manual đã chặn participant không thuộc Team `CONFIRMED`.
- Mentor assignment đã giới hạn Team `CONFIRMED`.
- Luồng team invitation kiểm tra tài khoản active, role participant, giới hạn người, trùng membership và thời gian đăng ký khá đầy đủ.
- Khi đạt sức chứa, competition có xử lý đóng đăng ký và từ chối các team chưa đủ điều kiện.
- Chat kiểm tra actor là member/leader/mentor của team và không mở cho team REJECTED/CANCELLED.
- Judge chỉ có thể ghi score sheet khi được gán vào board chứa team đó; phiếu đã submit được khóa.
- Media upload kiểm tra participant đã JOINED competition, team ownership, loại/kích thước file và trạng thái duyệt.
- AI không được dùng làm điểm judge chính thức; audit log ghi `aiInfluence: false` khi nộp phiếu.

## 5. Thứ tự sửa đề xuất

### Đợt 1 — Trước demo có dữ liệu thật

1. BE-01, BE-02, BE-03: khóa ownership và data scope.
2. BE-06, BE-07: thống nhất check-in/gia nhập competition.
3. BE-11, BE-12, BE-13, BE-14: khóa luồng nộp và chấm.
4. BE-15, BE-16, BE-17: bảo đảm kết quả công bằng.

### Đợt 2 — Trước vận hành sự kiện

1. BE-04, BE-05: lifecycle competition.
2. BE-08, BE-09, BE-10: nhiều vòng và judging board.
3. BE-19, BE-20, BE-21, BE-32: GitHub/worker/retry.
4. BE-22, BE-23, BE-24: policy tài nguyên con.

### Đợt 3 — Củng cố hệ thống

1. BE-25 đến BE-31.
2. Bổ sung integration test theo role và test chuyển trạng thái.
3. Thêm monitoring, audit dashboard, backup/restore rehearsal.

## 6. Bộ kiểm thử hồi quy tối thiểu

- Mỗi endpoint quan trọng chạy với đủ 7 role; kiểm tra cả 200/403 và dữ liệu trả về không vượt scope.
- Competition DRAFT không xuất hiện qua competition, workshop, track, timeline, media, submission, ranking.
- Participant đội A không đọc/ghi dữ liệu riêng của đội B.
- Check-in ngoài cửa sổ, team WAITING/REJECTED/CANCELLED đều thất bại.
- Không thể nộp bài sau deadline hoặc khi scoring đã bắt đầu.
- Không thể chấm khi không phải judge ACTIVE, không thuộc board, thiếu criterion hoặc bài chưa hợp lệ.
- Không generate/publish ranking khi thiếu judge score hoặc tie cutoff chưa giải quyết.
- Hai round liên tiếp không ghi đè placement của nhau.
- GitHub lỗi tạm thời giữ trạng thái pending/failed và retry thành công không tạo repo/collaborator trùng.
- API/worker restart không làm mất job; webhook duplicate được xử lý idempotent.

## 7. Kết luận

Backend có nền tảng chức năng rộng và nhiều rule cốt lõi đã hiện hữu, nhưng vẫn còn các lỗ hổng ownership/data scope và tính nhất quán vòng chấm cần xử lý trước khi dùng cho một cuộc thi có kết quả chính thức. Các mục P0/P1 nên được chuyển thành ticket có người phụ trách, tiêu chí nghiệm thu và test hồi quy; không nên chỉ xử lý ở FE vì API vẫn có thể bị gọi trực tiếp.

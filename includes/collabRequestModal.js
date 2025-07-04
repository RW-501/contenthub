


const form = document.getElementById("collabRequestForm");




form.addEventListener("submit", async (e) => {
  e.preventDefault();
    const toUid = collabBtn.dataset.viewingUserId;

  const user = auth.currentUser;
  if (!user || !toUid || user.uid === toUid) return;

  const message = document.getElementById("collabMessage").value.trim();
  const title = document.getElementById("collabTitle").value.trim();
  const description = document.getElementById("collabDesc").value.trim();
  const url = document.getElementById("collabUrl").value.trim();
  const file = document.getElementById("collabMedia").files[0];

  if (!message) return alert("Please enter a message or pitch.");

  // Prevent duplicate or recent declined requests
  const q = query(collection(db, "collabRequests"), where("fromUid", "==", user.uid), where("toUid", "==", toUid));
  const snapshot = await getDocs(q);
  for (const docSnap of snapshot.docs) {
    const req = docSnap.data();
    if (req.status === "pending") {
      return alert("You already have a pending request to this user.");
    }
    if (req.status === "declined" && req.timestamp?.toDate()) {
      const declinedAt = req.timestamp.toDate();
      const cooldown = new Date(declinedAt);
      cooldown.setDate(cooldown.getDate() + 30);
      if (new Date() < cooldown) {
        return alert("You can resend a request to this user after 30 days from your last declined request.");
      }
    }
  }

  let mediaLink = url || null;
  if (!mediaLink && file) {
    const storageRef = ref(storage, `collabPreviews/${user.uid}_${Date.now()}_${file.name}`);
    await uploadBytes(storageRef, file);
    mediaLink = await getDownloadURL(storageRef);
  }

  await addDoc(collection(db, "collabRequests"), {
    fromUid: user.uid,
    toUid,
    message,
    title,
    description,
    mediaLink,
    status: "pending",
    timestamp: serverTimestamp()
  });

  alert("Collaboration request sent!");
  form.reset();
  bootstrap.Modal.getInstance(document.getElementById("collabRequestModal")).hide();
});